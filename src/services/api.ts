const API_URL = import.meta.env.PROD 
  ? '/api'  // Em produção, usa o caminho relativo
  : 'http://localhost:3001/api'  // Em desenvolvimento, usa localhost

export interface RaffleNumber {
  id: number
  buyer: string
  selected: boolean
}

export const api = {
  async getNumbers(): Promise<RaffleNumber[]> {
    const response = await fetch(`${API_URL}/numbers`)
    if (!response.ok) {
      throw new Error('Failed to fetch numbers')
    }
    return response.json()
  },

  async purchaseNumbers(numbers: number[], buyer: string, password: string): Promise<void> {
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
  },
} 