import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'https://rifa-marlizee.vercel.app/api'

export interface RaffleNumber {
  number: number
  isAvailable: boolean
  purchasedBy?: string
  purchaseDate?: string
}

export const api = {
  async getNumbers(): Promise<RaffleNumber[]> {
    try {
      const response = await axios.get(`${API_URL}/numbers`)
      return response.data
    } catch (error) {
      console.error('Error fetching numbers:', error)
      throw new Error('Erro ao carregar os números')
    }
  },

  async purchaseNumbers(numbers: number[], buyerName: string, password: string): Promise<RaffleNumber[]> {
    try {
      const response = await axios.post(`${API_URL}/numbers/purchase`, {
        numbers,
        buyerName,
        password
      })
      
      if (response.data.allNumbers) {
        return response.data.allNumbers
      }
      
      throw new Error('Resposta inválida do servidor')
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
      console.error('Error purchasing numbers:', error)
      throw new Error('Erro ao comprar números')
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