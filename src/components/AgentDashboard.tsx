import { useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { User, Form } from '../types'
import { useKV } from '@github/spark/hooks'
import { googleSheetsService, SheetsConfig } from '../services/googleSheets'
import { formCompletionTracker, FormCompletionEvent } from '../services/formCompletionTracker'
import { 
  FileText, 
  ExternalLink, 
  SignOut, 
  Clock,
  CheckCircle,
  Eye
} from '@phosphor-icons/react'
import { toast } from 'sonner'

interface AgentDashboardProps {
  user: User
  forms: Form[]
  setForms: (forms: Form[] | ((prev: Form[]) => Form[])) => void
  onLogout: () => void
}

export default function AgentDashboard({
  user,
  forms,
  setForms,
  onLogout
}: AgentDashboardProps) {
  const [sheetsConfig] = useKV<SheetsConfig | null>('sheetsConfig', null)

  useEffect(() => {
    if (sheetsConfig) {
      googleSheetsService.initialize(sheetsConfig)
    }
  }, [sheetsConfig])

  // Handle automatic form completion detection
  const handleFormCompletion = useCallback(async (event: FormCompletionEvent) => {
    const form = forms.find(f => f.id === event.formId)
    if (!form) return

    const newTimestamp = event.completedAt
    
    // Update local state
    setForms(prevForms => 
      prevForms.map(f => 
        f.id === event.formId 
          ? {
              ...f,
              status: f.status.map(s => 
                s.agentId === event.agentId
                  ? { 
                      ...s, 
                      status: 'completed' as const, 
                      completedAt: newTimestamp,
                      openedAt: s.openedAt || newTimestamp
                    }
                  : s
              )
            }
          : f
      )
    )
    
    // Update Google Sheets if configured
    if (sheetsConfig) {
      try {
        await googleSheetsService.updateFormStatus(
          {
            formId: event.formId,
            agentId: event.agentId,
            status: 'completed',
            timestamp: newTimestamp
          },
          form.title,
          user.name
        )
        toast.success('טופס הושלם אוטומטית ועודכן בGoogle Sheets!')
      } catch (error) {
        console.error('Error updating Google Sheets:', error)
        toast.success('טופס הושלם אוטומטית!')
      }
    } else {
      toast.success('טופס הושלם אוטומטically!')
    }
  }, [forms, sheetsConfig, setForms, user.name])
  
  // Get forms assigned to this agent
  const assignedForms = forms.filter(form => 
    form.assignedAgents.includes(user.id)
  )

  // Get agent's status for each form
  const getAgentStatus = (form: Form) => {
    return form.status.find(s => s.agentId === user.id)
  }

  const handleOpenForm = async (form: Form) => {
    const currentStatus = getAgentStatus(form)
    const newTimestamp = new Date().toISOString()
    
    // Update status to 'opened' when agent clicks the form
    setForms(prevForms => 
      prevForms.map(f => 
        f.id === form.id 
          ? {
              ...f,
              status: f.status.map(s => 
                s.agentId === user.id && s.status === 'not-opened'
                  ? { ...s, status: 'opened' as const, openedAt: newTimestamp }
                  : s
              )
            }
          : f
      )
    )
    
    // Update Google Sheets if configured and status was 'not-opened'
    if (sheetsConfig && currentStatus?.status === 'not-opened') {
      try {
        await googleSheetsService.updateFormStatus(
          {
            formId: form.id,
            agentId: user.id,
            status: 'opened',
            timestamp: newTimestamp
          },
          form.title,
          user.name
        )
      } catch (error) {
        console.error('Error updating Google Sheets:', error)
      }
    }
    
    // Set up automatic form completion tracking
    const sessionId = `${form.id}_${user.id}_${Date.now()}`
    formCompletionTracker.onFormCompletion(sessionId, handleFormCompletion)
    
    // Monitor for completion using URL monitoring method
    const cleanup = formCompletionTracker.monitorFormCompletion(form.id, user.id, form.formUrl)
    
    // Cleanup after 1 hour
    setTimeout(cleanup, 60 * 60 * 1000)
    
    // Open form in new tab
    window.open(form.formUrl, '_blank')
    toast.success('הטופס נפתח - הסטטוס עודכן')
  }

  const markAsCompleted = async (form: Form) => {
    const newTimestamp = new Date().toISOString()
    const currentStatus = getAgentStatus(form)
    
    setForms(prevForms => 
      prevForms.map(f => 
        f.id === form.id 
          ? {
              ...f,
              status: f.status.map(s => 
                s.agentId === user.id
                  ? { 
                      ...s, 
                      status: 'completed' as const, 
                      completedAt: newTimestamp,
                      openedAt: s.openedAt || newTimestamp
                    }
                  : s
              )
            }
          : f
      )
    )
    
    // Update Google Sheets if configured
    if (sheetsConfig) {
      try {
        await googleSheetsService.updateFormStatus(
          {
            formId: form.id,
            agentId: user.id,
            status: 'completed',
            timestamp: newTimestamp
          },
          form.title,
          user.name
        )
        toast.success('הטופס סומן כהושלם ועודכן בGoogle Sheets!')
      } catch (error) {
        console.error('Error updating Google Sheets:', error)
        toast.success('הטופס סומן כהושלם!')
      }
    } else {
      toast.success('הטופס סומן כהושלם!')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle size={14} className="ml-1" />
            הושלם
          </Badge>
        )
      case 'opened':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Eye size={14} className="ml-1" />
            נפתח
          </Badge>
        )
      case 'not-opened':
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-600">
            <Clock size={14} className="ml-1" />
            ממתין
          </Badge>
        )
      default:
        return <Badge variant="outline">לא ידוע</Badge>
    }
  }

  const completedCount = assignedForms.filter(form => {
    const status = getAgentStatus(form)
    return status?.status === 'completed'
  }).length

  const pendingCount = assignedForms.filter(form => {
    const status = getAgentStatus(form)
    return status?.status !== 'completed'
  }).length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <FileText size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">הטפסים שלי</h1>
              <p className="text-sm text-muted-foreground">שלום, {user.name}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <SignOut size={16} />
            התנתק
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">סך הכל טפסים</p>
                  <p className="text-2xl font-bold text-foreground">{assignedForms.length}</p>
                </div>
                <FileText size={24} className="text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">הושלמו</p>
                  <p className="text-2xl font-bold text-green-600">{completedCount}</p>
                </div>
                <CheckCircle size={24} className="text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">ממתינים</p>
                  <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
                </div>
                <Clock size={24} className="text-yellow-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Forms List */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">הטפסים המוקצים לי</h2>
          
          {assignedForms.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText size={48} className="mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">אין טפסים מוקצים</h3>
                <p className="text-muted-foreground">
                  המנהל עדיין לא הקצה לך טפסים. נא פנה למנהל למידע נוסף.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {assignedForms.map((form) => {
                const status = getAgentStatus(form)
                const isCompleted = status?.status === 'completed'
                
                return (
                  <Card key={form.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{form.title}</CardTitle>
                          {form.description && (
                            <CardDescription className="mt-1">{form.description}</CardDescription>
                          )}
                        </div>
                        {getStatusBadge(status?.status || 'not-opened')}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>נוצר: {new Date(form.createdAt).toLocaleDateString('he-IL')}</span>
                          {status?.openedAt && (
                            <span>נפתח: {new Date(status.openedAt).toLocaleDateString('he-IL')}</span>
                          )}
                          {status?.completedAt && (
                            <span>הושלם: {new Date(status.completedAt).toLocaleDateString('he-IL')}</span>
                          )}
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleOpenForm(form)}
                            className="flex-1"
                            variant={status?.status === 'not-opened' ? 'default' : 'outline'}
                          >
                            <ExternalLink size={16} />
                            {status?.status === 'not-opened' ? 'פתח טופס' : 'פתח שוב'}
                          </Button>
                          
                          {!isCompleted && status?.status !== 'not-opened' && (
                            <Button
                              onClick={() => markAsCompleted(form)}
                              variant="default"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle size={16} />
                              סמן כהושלם
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}