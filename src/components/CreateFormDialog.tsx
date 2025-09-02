import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Checkbox } from './ui/checkbox'
import { User } from '../types'
import { toast } from 'sonner'

interface CreateFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agents: User[]
  onCreateForm: (formData: {
    title: string
    description: string
    formUrl: string
    assignedAgents: string[]
  }) => void
}

export default function CreateFormDialog({
  open,
  onOpenChange,
  agents,
  onCreateForm
}: CreateFormDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [assignedAgents, setAssignedAgents] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title || !formUrl || assignedAgents.length === 0) {
      toast.error('יש למלא את כל השדות הנדרשים')
      return
    }

    // Validate URL
    try {
      new URL(formUrl)
    } catch {
      toast.error('כתובת URL לא תקינה')
      return
    }

    setIsSubmitting(true)
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    onCreateForm({
      title,
      description,
      formUrl,
      assignedAgents
    })
    
    // Reset form
    setTitle('')
    setDescription('')
    setFormUrl('')
    setAssignedAgents([])
    setIsSubmitting(false)
    
    toast.success('הטופס נוצר בהצלחה')
  }

  const handleAgentToggle = (agentId: string, checked: boolean) => {
    if (checked) {
      setAssignedAgents(prev => [...prev, agentId])
    } else {
      setAssignedAgents(prev => prev.filter(id => id !== agentId))
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setTitle('')
      setDescription('')
      setFormUrl('')
      setAssignedAgents([])
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>צור טופס חדש</DialogTitle>
          <DialogDescription>
            הוסף טופס Google Forms חדש והקצה אותו לסוכנים
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">כותרת הטופס *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="הכנס כותרת לטופס"
              required
              dir="rtl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">תיאור</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="תיאור קצר של הטופס (אופציונלי)"
              rows={3}
              dir="rtl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="formUrl">קישור לטופס Google Forms *</Label>
            <Input
              id="formUrl"
              type="url"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://docs.google.com/forms/..."
              required
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">
              העתק את הקישור מטופס Google Forms קיים
            </p>
          </div>

          <div className="space-y-3">
            <Label>הקצה לסוכנים *</Label>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {agents.length === 0 ? (
                <p className="text-sm text-muted-foreground">אין סוכנים זמינים</p>
              ) : (
                agents.map((agent) => (
                  <div key={agent.id} className="flex items-center space-x-2 space-x-reverse">
                    <Checkbox
                      id={agent.id}
                      checked={assignedAgents.includes(agent.id)}
                      onCheckedChange={(checked) => 
                        handleAgentToggle(agent.id, checked === true)
                      }
                    />
                    <Label 
                      htmlFor={agent.id}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      {agent.name} ({agent.username})
                    </Label>
                  </div>
                ))
              )}
            </div>
            {assignedAgents.length > 0 && (
              <p className="text-xs text-muted-foreground">
                נבחרו {assignedAgents.length} סוכנים
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              ביטול
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !title || !formUrl || assignedAgents.length === 0}
              className="flex-1"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  יוצר...
                </div>
              ) : (
                'צור טופס'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}