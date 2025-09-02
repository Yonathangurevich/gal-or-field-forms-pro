import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { User } from '../types'
import { toast } from 'sonner'

interface CreateAgentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingUsers: User[]
  onCreateAgent: (agentData: {
    username: string
    password: string
    name: string
    phone: string
  }) => void
}

export default function CreateAgentDialog({
  open,
  onOpenChange,
  existingUsers,
  onCreateAgent
}: CreateAgentDialogProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!username || !password || !name || !phone) {
      toast.error('יש למלא את כל השדות')
      return
    }

    // Check if username already exists
    if (existingUsers.some(user => user.username === username)) {
      toast.error('שם המשתמש כבר קיים במערכת')
      return
    }

    // Basic password validation
    if (password.length < 6) {
      toast.error('הסיסמה חייבת להכיל לפחות 6 תווים')
      return
    }

    // Basic phone validation
    if (!/^0\d{1,2}-?\d{7}$/.test(phone.replace(/\s/g, ''))) {
      toast.error('מספר טלפון לא תקין')
      return
    }

    setIsSubmitting(true)
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    onCreateAgent({
      username,
      password,
      name,
      phone
    })
    
    // Reset form
    setUsername('')
    setPassword('')
    setName('')
    setPhone('')
    setIsSubmitting(false)
    
    toast.success('הסוכן נוצר בהצלחה')
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setUsername('')
      setPassword('')
      setName('')
      setPhone('')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>הוסף סוכן חדש</DialogTitle>
          <DialogDescription>
            צור חשבון משתמש חדש עבור סוכן בשטח
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent-name">שם מלא *</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="הכנס שם מלא"
              required
              dir="rtl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-phone">מספר טלפון *</Label>
            <Input
              id="agent-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="050-1234567"
              required
              dir="rtl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-username">שם משתמש *</Label>
            <Input
              id="agent-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="שם משתמש ייחודי"
              required
              dir="rtl"
            />
            <p className="text-xs text-muted-foreground">
              שם המשתמש יהיה ייחודי במערכת
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-password">סיסמה *</Label>
            <Input
              id="agent-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="לפחות 6 תווים"
              required
              dir="rtl"
            />
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
              disabled={isSubmitting || !username || !password || !name || !phone}
              className="flex-1"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  יוצר...
                </div>
              ) : (
                'צור סוכן'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}