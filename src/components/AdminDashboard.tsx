import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { User, Form, FormStatus } from '../types'
import CreateFormDialog from './CreateFormDialog'
import CreateAgentDialog from './CreateAgentDialog'
import SheetsConfigDialog from './SheetsConfigDialog'
import { useKV } from '@github/spark/hooks'
import { googleSheetsService, SheetsConfig } from '../services/googleSheets'
import { toast } from 'sonner'
import { 
  Plus, 
  Users, 
  FileText, 
  CheckCircle, 
  Clock, 
  SignOut,
  Bell,
  UserPlus,
  FilePlus,
  Settings
} from '@phosphor-icons/react'

interface AdminDashboardProps {
  user: User
  users: User[]
  setUsers: (users: User[] | ((prev: User[]) => User[])) => void
  forms: Form[]
  setForms: (forms: Form[] | ((prev: Form[]) => Form[])) => void
  onLogout: () => void
}

export default function AdminDashboard({
  user,
  users,
  setUsers,
  forms,
  setForms,
  onLogout
}: AdminDashboardProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showCreateAgent, setShowCreateAgent] = useState(false)
  const [showSheetsConfig, setShowSheetsConfig] = useState(false)
  const [sheetsConfig, setSheetsConfig] = useKV<SheetsConfig | null>('sheetsConfig', null)

  useEffect(() => {
    if (sheetsConfig) {
      googleSheetsService.initialize(sheetsConfig)
    }
  }, [sheetsConfig])

  const agents = users.filter(u => u.role === 'agent')
  
  const totalForms = forms.length
  const totalAgents = agents.length
  
  // Calculate completion statistics
  const allStatuses = forms.flatMap(form => form.status)
  const completedCount = allStatuses.filter(s => s.status === 'completed').length
  const openedCount = allStatuses.filter(s => s.status === 'opened').length
  const notOpenedCount = allStatuses.filter(s => s.status === 'not-opened').length

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">הושלם</Badge>
      case 'opened':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">נפתח</Badge>
      case 'not-opened':
        return <Badge variant="outline" className="bg-gray-100 text-gray-600">לא נפתח</Badge>
      default:
        return <Badge variant="outline">לא ידוע</Badge>
    }
  }

  const getAgentFormStatus = (agentId: string, formId: string): FormStatus | undefined => {
    const form = forms.find(f => f.id === formId)
    return form?.status.find(s => s.agentId === agentId)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Users size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">לוח בקרה מנהל</h1>
              <p className="text-sm text-muted-foreground">שלום, {user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowSheetsConfig(true)}
              className={!sheetsConfig ? 'border-orange-200 bg-orange-50 text-orange-700' : ''}
            >
              <Settings size={16} />
              הגדרות Google Sheets
            </Button>
            <Button variant="outline" size="sm">
              <Bell size={16} />
              התראות
            </Button>
            <Button variant="ghost" size="sm" onClick={onLogout}>
              <SignOut size={16} />
              התנתק
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">סך הכל טפסים</p>
                  <p className="text-2xl font-bold text-foreground">{totalForms}</p>
                </div>
                <FileText size={24} className="text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">סוכנים פעילים</p>
                  <p className="text-2xl font-bold text-foreground">{totalAgents}</p>
                </div>
                <Users size={24} className="text-primary" />
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
                  <p className="text-sm font-medium text-muted-foreground">בהמתנה</p>
                  <p className="text-2xl font-bold text-yellow-600">{notOpenedCount + openedCount}</p>
                </div>
                <Clock size={24} className="text-yellow-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="forms" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList className="grid w-fit grid-cols-2">
              <TabsTrigger value="forms">טפסים</TabsTrigger>
              <TabsTrigger value="agents">סוכנים</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Button onClick={() => setShowCreateForm(true)}>
                <FilePlus size={16} />
                הוסף טופס
              </Button>
              <Button variant="outline" onClick={() => setShowCreateAgent(true)}>
                <UserPlus size={16} />
                הוסף סוכן
              </Button>
            </div>
          </div>

          {/* Forms Tab */}
          <TabsContent value="forms" className="space-y-4">
            {forms.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <FileText size={48} className="mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">אין טפסים עדיין</h3>
                  <p className="text-muted-foreground mb-4">התחל ביצירת הטופס הראשון שלך</p>
                  <Button onClick={() => setShowCreateForm(true)}>
                    <Plus size={16} />
                    צור טופס חדש
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {forms.map((form) => (
                  <Card key={form.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{form.title}</CardTitle>
                          <CardDescription className="mt-1">{form.description}</CardDescription>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          {form.assignedAgents.length} סוכנים
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {form.status.map((status) => {
                            const agent = agents.find(a => a.id === status.agentId)
                            return (
                              <div key={status.agentId} className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">{agent?.name}:</span>
                                {getStatusBadge(status.status)}
                              </div>
                            )
                          })}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-sm text-muted-foreground">
                            נוצר: {new Date(form.createdAt).toLocaleDateString('he-IL')}
                          </span>
                          <Button variant="outline" size="sm" asChild>
                            <a href={form.formUrl} target="_blank" rel="noopener noreferrer">
                              צפה בטופס
                            </a>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Agents Tab */}
          <TabsContent value="agents" className="space-y-4">
            {agents.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Users size={48} className="mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">אין סוכנים עדיין</h3>
                  <p className="text-muted-foreground mb-4">הוסף סוכנים כדי להתחיל להקצות טפסים</p>
                  <Button onClick={() => setShowCreateAgent(true)}>
                    <Plus size={16} />
                    הוסף סוכן
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map((agent) => {
                  const agentForms = forms.filter(form => form.assignedAgents.includes(agent.id))
                  const completedForms = agentForms.filter(form => {
                    const status = form.status.find(s => s.agentId === agent.id)
                    return status?.status === 'completed'
                  }).length
                  
                  return (
                    <Card key={agent.id}>
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <Users size={20} className="text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{agent.name}</CardTitle>
                            <CardDescription>{agent.phone}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">טפסים מוקצים:</span>
                            <span className="font-medium">{agentForms.length}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">הושלמו:</span>
                            <span className="font-medium text-green-600">{completedForms}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">תאריך הצטרפות:</span>
                            <span className="font-medium">
                              {new Date(agent.createdAt).toLocaleDateString('he-IL')}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <CreateFormDialog
        open={showCreateForm}
        onOpenChange={setShowCreateForm}
        agents={agents}
        onCreateForm={async (formData) => {
          const newForm: Form = {
            id: Date.now().toString(),
            title: formData.title,
            description: formData.description,
            formUrl: formData.formUrl,
            assignedAgents: formData.assignedAgents,
            createdBy: user.id,
            createdAt: new Date().toISOString(),
            status: formData.assignedAgents.map(agentId => ({
              agentId,
              status: 'not-opened' as const
            }))
          }
          
          // Update Google Sheets with form status for each assigned agent
          if (sheetsConfig) {
            try {
              for (const agentId of formData.assignedAgents) {
                const agent = agents.find(a => a.id === agentId)
                if (agent) {
                  await googleSheetsService.updateFormStatus(
                    {
                      formId: newForm.id,
                      agentId: agentId,
                      status: 'not-opened',
                      timestamp: new Date().toISOString()
                    },
                    formData.title,
                    agent.name
                  )
                }
              }
              toast.success('הטופס נוצר ונשמר בGoogle Sheets!')
            } catch (error) {
              console.error('Error updating Google Sheets:', error)
              toast.error('הטופס נוצר אבל לא עודכן בGoogle Sheets')
            }
          }
          
          setForms(prev => [...prev, newForm])
          setShowCreateForm(false)
        }}
      />
      
      <CreateAgentDialog
        open={showCreateAgent}
        onOpenChange={setShowCreateAgent}
        existingUsers={users}
        onCreateAgent={(agentData) => {
          const newAgent: User = {
            id: Date.now().toString(),
            username: agentData.username,
            password: agentData.password,
            name: agentData.name,
            phone: agentData.phone,
            role: 'agent',
            createdAt: new Date().toISOString()
          }
          setUsers(prev => [...prev, newAgent])
          setShowCreateAgent(false)
        }}
      />
      
      <SheetsConfigDialog
        open={showSheetsConfig}
        onOpenChange={setShowSheetsConfig}
        currentConfig={sheetsConfig}
        onConfigSaved={(config) => {
          setSheetsConfig(config)
          toast.success('הגדרות Google Sheets נשמרו בהצלחה!')
        }}
      />
    </div>
  )
}