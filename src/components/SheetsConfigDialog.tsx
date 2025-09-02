import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from './ui/dialog'
import { toast } from 'sonner'
import { googleSheetsService, SheetsConfig } from '../services/googleSheets'
import { Settings, ExternalLink } from '@phosphor-icons/react'

interface SheetsConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfigSaved: (config: SheetsConfig) => void
  currentConfig?: SheetsConfig | null
}

export default function SheetsConfigDialog({
  open,
  onOpenChange,
  onConfigSaved,
  currentConfig
}: SheetsConfigDialogProps) {
  const [apiKey, setApiKey] = useState(currentConfig?.apiKey || '')
  const [spreadsheetId, setSpreadsheetId] = useState(currentConfig?.spreadsheetId || '')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!apiKey.trim() || !spreadsheetId.trim()) {
      toast.error('יש למלא את כל השדות')
      return
    }

    setLoading(true)
    try {
      const config: SheetsConfig = {
        apiKey: apiKey.trim(),
        spreadsheetId: spreadsheetId.trim()
      }

      // Test the connection
      googleSheetsService.initialize(config)
      await googleSheetsService.createOrUpdateStatusSheet()
      
      onConfigSaved(config)
      toast.success('ההגדרות נשמרו בהצלחה!')
      onOpenChange(false)
    } catch (error) {
      console.error('Error testing Google Sheets connection:', error)
      toast.error('שגיאה בחיבור לגוגל שיטס. בדוק את ההגדרות')
    } finally {
      setLoading(false)
    }
  }

  const extractSpreadsheetId = (url: string) => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    return match ? match[1] : url
  }

  const handleSpreadsheetIdChange = (value: string) => {
    // Auto-extract ID from URL if user pastes a full Google Sheets URL
    const extractedId = extractSpreadsheetId(value)
    setSpreadsheetId(extractedId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings size={20} />
            הגדרות Google Sheets
          </DialogTitle>
          <DialogDescription>
            הגדר את הקישור לגוגל שיטס כדי לשמור את נתוני הטפסים
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">Google Sheets API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="הכנס את ה-API Key שלך"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">
              <a 
                href="https://console.developers.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                קבל API Key מכאן
                <ExternalLink size={12} />
              </a>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="spreadsheetId">מזהה גיליון אלקטרוני</Label>
            <Input
              id="spreadsheetId"
              value={spreadsheetId}
              onChange={(e) => handleSpreadsheetIdChange(e.target.value)}
              placeholder="הכנס את מזהה הגיליון או קישור מלא"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">
              ניתן להדביק קישור מלא לגיליון האלקטרוני או רק את המזהה
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <h4 className="font-medium text-blue-900 mb-2">הוראות הגדרה:</h4>
            <ol className="text-sm text-blue-800 space-y-1">
              <li>1. צור גיליון אלקטרוני חדש בגוגל דרייב</li>
              <li>2. קבל API Key מהקישור למעלה</li>
              <li>3. הפעל את Google Sheets API בקונסולה</li>
              <li>4. העתק את המזהה מכתובת הגיליון</li>
            </ol>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            ביטול
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'שומר...' : 'שמור'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}