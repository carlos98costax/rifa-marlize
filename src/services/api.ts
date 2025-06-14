const API_URL = import.meta.env.PROD 
  ? '/api/numbers'  // Em produção, usa o caminho relativo
  : 'http://localhost:3001/api/numbers'  // Em desenvolvimento, usa localhost

export interface RaffleNumber {
  number: number
  isAvailable: boolean
  purchasedBy: string | null
  purchaseDate: Date | null
}

interface PurchaseResponse {
  message: string
  numbers: number[]
  buyer: string
  purchaseDate: string
  timestamp: string
  updatedNumbers: RaffleNumber[]
}

export const api = {
  async getNumbers(): Promise<RaffleNumber[]> {
    try {
      const response = await fetch(`${API_URL}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch numbers')
      }
      return response.json()
    } catch (error) {
      console.error('Error fetching numbers:', error)
      throw error
    }
  },

  async purchaseNumbers(numbers: number[], buyer: string, password: string): Promise<RaffleNumber[]> {
    try {
      const response = await fetch(`${API_URL}/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ numbers, buyer, password }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to purchase numbers')
      }

      const data: PurchaseResponse = await response.json()
      return data.updatedNumbers
    } catch (error) {
      console.error('Error purchasing numbers:', error)
      throw error
    }
  },

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch('/api/health')
      if (!response.ok) {
        return false
      }
      const data = await response.json()
      return data.status === 'ok'
    } catch (error) {
      console.error('Health check failed:', error)
      return false
    }
  }
} 