import { google, sheets_v4 } from 'googleapis'

export interface SheetsConfig {
  apiKey: string
  spreadsheetId: string
}

export interface FormResponse {
  formId: string
  agentId: string
  agentName: string
  formTitle: string
  responses: Record<string, any>
  submittedAt: string
  status: 'completed' | 'in-progress'
}

export interface FormStatusUpdate {
  formId: string
  agentId: string
  status: 'not-opened' | 'opened' | 'completed'
  timestamp: string
}

class GoogleSheetsService {
  private sheets: sheets_v4.Sheets | null = null
  private config: SheetsConfig | null = null

  initialize(config: SheetsConfig) {
    this.config = config
    this.sheets = google.sheets({
      version: 'v4',
      auth: config.apiKey
    })
  }

  private ensureInitialized() {
    if (!this.sheets || !this.config) {
      throw new Error('Google Sheets service not initialized. Call initialize() first.')
    }
  }

  async createOrUpdateStatusSheet() {
    this.ensureInitialized()
    
    const sheetName = 'Form_Status'
    const headers = [
      'Form ID',
      'Form Title', 
      'Agent ID',
      'Agent Name',
      'Status',
      'Opened At',
      'Completed At',
      'Last Updated'
    ]

    try {
      // Check if sheet exists
      const response = await this.sheets!.spreadsheets.get({
        spreadsheetId: this.config!.spreadsheetId
      })

      const existingSheet = response.data.sheets?.find(
        sheet => sheet.properties?.title === sheetName
      )

      if (!existingSheet) {
        // Create new sheet
        await this.sheets!.spreadsheets.batchUpdate({
          spreadsheetId: this.config!.spreadsheetId,
          requestBody: {
            requests: [{
              addSheet: {
                properties: {
                  title: sheetName
                }
              }
            }]
          }
        })

        // Add headers
        await this.sheets!.spreadsheets.values.update({
          spreadsheetId: this.config!.spreadsheetId,
          range: `${sheetName}!A1:H1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [headers]
          }
        })
      }

      return sheetName
    } catch (error) {
      console.error('Error creating/updating status sheet:', error)
      throw error
    }
  }

  async updateFormStatus(statusUpdate: FormStatusUpdate, formTitle: string, agentName: string) {
    this.ensureInitialized()
    
    const sheetName = await this.createOrUpdateStatusSheet()
    
    try {
      // Get existing data to check if row exists
      const response = await this.sheets!.spreadsheets.values.get({
        spreadsheetId: this.config!.spreadsheetId,
        range: `${sheetName}!A:H`
      })

      const rows = response.data.values || []
      const headerRow = rows[0] || []
      const dataRows = rows.slice(1)
      
      // Find existing row
      const existingRowIndex = dataRows.findIndex(row => 
        row[0] === statusUpdate.formId && row[2] === statusUpdate.agentId
      )

      const newRow = [
        statusUpdate.formId,
        formTitle,
        statusUpdate.agentId, 
        agentName,
        statusUpdate.status,
        statusUpdate.status === 'opened' ? statusUpdate.timestamp : (existingRowIndex >= 0 ? dataRows[existingRowIndex][5] : ''),
        statusUpdate.status === 'completed' ? statusUpdate.timestamp : '',
        statusUpdate.timestamp
      ]

      if (existingRowIndex >= 0) {
        // Update existing row
        const rowNumber = existingRowIndex + 2 // +1 for header, +1 for 1-based indexing
        await this.sheets!.spreadsheets.values.update({
          spreadsheetId: this.config!.spreadsheetId,
          range: `${sheetName}!A${rowNumber}:H${rowNumber}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [newRow]
          }
        })
      } else {
        // Add new row
        await this.sheets!.spreadsheets.values.append({
          spreadsheetId: this.config!.spreadsheetId,
          range: `${sheetName}!A:H`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [newRow]
          }
        })
      }
    } catch (error) {
      console.error('Error updating form status:', error)
      throw error
    }
  }

  async createFormResponsesSheet(formId: string, formTitle: string, questionFields: string[]) {
    this.ensureInitialized()
    
    const sheetName = `Form_${formId}_Responses`
    const headers = [
      'Response ID',
      'Agent ID', 
      'Agent Name',
      'Submitted At',
      ...questionFields,
      'Status'
    ]

    try {
      // Create new sheet
      await this.sheets!.spreadsheets.batchUpdate({
        spreadsheetId: this.config!.spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: sheetName
              }
            }
          }]
        }
      })

      // Add headers
      await this.sheets!.spreadsheets.values.update({
        spreadsheetId: this.config!.spreadsheetId,
        range: `${sheetName}!A1:${String.fromCharCode(65 + headers.length - 1)}1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers]
        }
      })

      return sheetName
    } catch (error) {
      console.error('Error creating form responses sheet:', error)
      throw error
    }
  }

  async saveFormResponse(response: FormResponse, questionFields: string[]) {
    this.ensureInitialized()
    
    const sheetName = `Form_${response.formId}_Responses`
    
    try {
      const responseRow = [
        `${response.formId}_${response.agentId}_${Date.now()}`,
        response.agentId,
        response.agentName,
        response.submittedAt,
        ...questionFields.map(field => response.responses[field] || ''),
        response.status
      ]

      await this.sheets!.spreadsheets.values.append({
        spreadsheetId: this.config!.spreadsheetId,
        range: `${sheetName}!A:${String.fromCharCode(65 + responseRow.length - 1)}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [responseRow]
        }
      })
    } catch (error) {
      console.error('Error saving form response:', error)
      throw error
    }
  }

  async getAllFormStatuses(): Promise<Array<{
    formId: string
    formTitle: string
    agentId: string
    agentName: string
    status: string
    openedAt: string
    completedAt: string
    lastUpdated: string
  }>> {
    this.ensureInitialized()
    
    try {
      const response = await this.sheets!.spreadsheets.values.get({
        spreadsheetId: this.config!.spreadsheetId,
        range: 'Form_Status!A:H'
      })

      const rows = response.data.values || []
      const dataRows = rows.slice(1) // Skip header

      return dataRows.map(row => ({
        formId: row[0] || '',
        formTitle: row[1] || '',
        agentId: row[2] || '',
        agentName: row[3] || '',
        status: row[4] || '',
        openedAt: row[5] || '',
        completedAt: row[6] || '',
        lastUpdated: row[7] || ''
      }))
    } catch (error) {
      console.error('Error getting form statuses:', error)
      return []
    }
  }
}

export const googleSheetsService = new GoogleSheetsService()