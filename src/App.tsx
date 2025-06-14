import { useState, useEffect } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import Slider from 'react-slick'
import { CheckIcon, HeartIcon, GiftIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { api, RaffleNumber } from './services/api'

function App() {
  const [numbers, setNumbers] = useState<RaffleNumber[]>([])
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([])
  const [buyerName, setBuyerName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNumbers()
  }, [])

  const loadNumbers = async () => {
    try {
      const data = await api.getNumbers()
      setNumbers(data)
    } catch (error) {
      toast.error('Erro ao carregar os números')
      console.error('Error loading numbers:', error)
    } finally {
      setLoading(false)
    }
  }

  const carouselSettings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 4000,
    fade: true,
    cssEase: 'linear'
  }

  const handleNumberClick = (number: number) => {
    const raffleNumber = numbers.find(n => n.number === number)
    if (!raffleNumber?.isAvailable) {
      toast.error('Este número já foi vendido!')
      return
    }

    setSelectedNumbers(prev => {
      if (prev.includes(number)) {
        return prev.filter(n => n !== number)
      }
      return [...prev, number]
    })
  }

  const handlePurchase = async () => {
    if (selectedNumbers.length === 0 || !buyerName.trim() || !password.trim()) {
      toast.error('Por favor, preencha todos os campos')
      return
    }

    try {
      await api.purchaseNumbers(selectedNumbers, buyerName.trim(), password.trim())
      toast.success('Números comprados com sucesso!')
      setSelectedNumbers([])
      setBuyerName('')
      setPassword('')
      loadNumbers()
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('Erro ao comprar números')
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-2xl text-gray-600">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-center" />

      {/* Hero Section with Carousel */}
      <div className="mb-12">
        <Slider {...carouselSettings}>
          <div className="h-80 bg-gradient-to-r from-indigo-500 to-blue-600 flex items-center justify-center relative">
            <div className="absolute inset-0 bg-black opacity-20"></div>
            <div className="relative z-10 text-center px-4">
              <HeartIcon className="h-16 w-16 text-white mx-auto mb-4" />
              <h2 className="text-4xl text-white font-bold mb-2">Rifa Solidária</h2>
              <p className="text-xl text-blue-100">Junte-se a nós nesta causa especial</p>
            </div>
          </div>
          <div className="h-80 bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center relative">
            <div className="absolute inset-0 bg-black opacity-20"></div>
            <div className="relative z-10 text-center px-4">
              <GiftIcon className="h-16 w-16 text-white mx-auto mb-4" />
              <h2 className="text-4xl text-white font-bold mb-2">Ajude uma Causa Nobre</h2>
              <p className="text-xl text-blue-100">Cada número faz a diferença</p>
            </div>
          </div>
          <div className="h-80 bg-gradient-to-r from-indigo-600 to-blue-500 flex items-center justify-center relative">
            <div className="absolute inset-0 bg-black opacity-20"></div>
            <div className="relative z-10 text-center px-4">
              <SparklesIcon className="h-16 w-16 text-white mx-auto mb-4" />
              <h2 className="text-4xl text-white font-bold mb-2">400 Números Disponíveis</h2>
              <p className="text-xl text-blue-100">Escolha seus números da sorte</p>
            </div>
          </div>
        </Slider>
      </div>

      {/* Cause Description */}
      <div className="max-w-4xl mx-auto px-4 mb-12">
        <div className="bg-white rounded-xl shadow-lg p-8 transform hover:scale-[1.02] transition-transform duration-300">
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Sobre a Causa</h2>
          <p className="text-gray-600 text-lg leading-relaxed">
            Esta rifa solidária foi criada para ajudar uma causa nobre. Cada número custa R$ 20,00,
            e você pode comprar quantos números desejar. Os números são escolhidos livremente,
            sem necessidade de sequência. Junte-se a nós nesta iniciativa e ajude a fazer a diferença!
          </p>
        </div>
      </div>

      {/* Purchase Form */}
      <div className="max-w-4xl mx-auto px-4 mb-12">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Escolha Seus Números</h2>
          
          {/* Buyer Name Input */}
          <div className="mb-6">
            <label htmlFor="buyerName" className="block text-sm font-medium text-gray-700 mb-2">
              Seu Nome
            </label>
            <input
              type="text"
              id="buyerName"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="Digite seu nome completo"
            />
          </div>

          {/* Password Input */}
          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Senha de Verificação
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="Digite a senha de verificação"
            />
          </div>

          {/* Numbers Grid */}
          <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 gap-2 mb-8">
            {numbers.map((number) => (
              <button
                key={number.number}
                onClick={() => handleNumberClick(number.number)}
                disabled={!number.isAvailable}
                className={`
                  relative p-2 rounded-lg text-center transition-all duration-200
                  ${!number.isAvailable 
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                    : selectedNumbers.includes(number.number)
                      ? 'bg-blue-600 text-white transform scale-105 shadow-lg'
                      : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200 hover:border-blue-300'
                  }
                `}
              >
                <span className="block text-base font-semibold">{number.number}</span>
                {!number.isAvailable && number.purchasedBy && (
                  <span className="block text-gray-500 text-[10px] leading-tight mt-1">
                    Vendido: {number.purchasedBy}
                  </span>
                )}
                {selectedNumbers.includes(number.number) && (
                  <span className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                    <CheckIcon className="w-3 h-3" />
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Purchase Button */}
          <div className="text-center">
            <button
              onClick={handlePurchase}
              disabled={selectedNumbers.length === 0 || !buyerName.trim() || !password.trim()}
              className={`
                px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-300
                ${selectedNumbers.length === 0 || !buyerName.trim() || !password.trim()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 shadow-lg'
                }
              `}
            >
              Comprar {selectedNumbers.length} Número{selectedNumbers.length !== 1 ? 's' : ''} 
              {selectedNumbers.length > 0 && ` - R$ ${(selectedNumbers.length * 20).toFixed(2)}`}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-300">© 2024 Rifa Solidária da Marlize. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  )
}

export default App 
