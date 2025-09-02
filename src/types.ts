export interface User {
  id: string
  username: string
  password: string // In production this would be hashed
  name: string
  phone: string
  role: 'admin' | 'agent'
  createdAt: string
}

export interface Form {
  id: string
  title: string
  description: string
  formUrl: string
  assignedAgents: string[] // Array of user IDs
  createdBy: string // User ID of admin who created
  createdAt: string
  status: FormStatus[]
}

export interface FormStatus {
  agentId: string
  status: 'not-opened' | 'opened' | 'completed'
  openedAt?: string
  completedAt?: string
}

export interface FormAssignment {
  id: string
  formId: string
  agentId: string
  assignedAt: string
  status: 'not-opened' | 'opened' | 'completed'
  openedAt?: string
  completedAt?: string
}