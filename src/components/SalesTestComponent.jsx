import { useState } from 'react'
import { supabase } from '../lib/supabase'
import supabasePushService from '../services/supabasePushService'

const SalesTestComponent = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [lastSale, setLastSale] = useState(null)
  const [testFormData, setTestFormData] = useState({
    valor: 150.99,
    produto: 'Produto de Teste',
    cliente: 'Cliente Teste'
  })

  // Simular uma venda para testar o sistema
  const simulateSale = async () => {
    setIsLoading(true)
    try {
      // Inserir venda na tabela
      const { data, error } = await supabase
        .from('vendas')
        .insert([{
          valor: testFormData.valor,
          produto: testFormData.produto,
          cliente: testFormData.cliente
        }])
        .select()
        .single()

      if (error) {
        console.error('Erro ao inserir venda:', error)
        alert('Erro ao inserir venda: ' + error.message)
        return
      }

      setLastSale(data)
      alert('Venda inserida com sucesso! As notificações devem ser enviadas automaticamente.')
      
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  // Testar notificação local
  const testLocalNotification = async () => {
    try {
      await supabasePushService.testSaleNotification()
      alert('Notificação local testada!')
    } catch (error) {
      console.error('Erro ao testar notificação:', error)
      alert('Erro ao testar notificação: ' + error.message)
    }
  }

  // Verificar quantas subscriptions ativas existem
  const checkActiveSubscriptions = async () => {
    try {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('id, created_at, user_agent')
        .eq('is_active', true)

      if (error) {
        console.error('Erro ao buscar subscriptions:', error)
        return
      }

      alert(`Subscriptions ativas: ${data?.length || 0}`)
      console.log('Subscriptions ativas:', data)
    } catch (error) {
      console.error('Erro:', error)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setTestFormData(prev => ({
      ...prev,
      [name]: name === 'valor' ? parseFloat(value) || 0 : value
    }))
  }

  return (
    <div style={{ 
      padding: '20px', 
      border: '2px solid #007bff', 
      borderRadius: '8px', 
      margin: '20px 0',
      backgroundColor: '#f8f9fa'
    }}>
      <h3>🧪 Teste do Sistema de Vendas e Notificações</h3>
      
      <div style={{ marginBottom: '20px' }}>
        <h4>Dados da Venda de Teste:</h4>
        <div style={{ display: 'grid', gap: '10px', maxWidth: '300px' }}>
          <div>
            <label>Valor (R$):</label>
            <input
              type="number"
              name="valor"
              value={testFormData.valor}
              onChange={handleInputChange}
              step="0.01"
              style={{ width: '100%', padding: '5px' }}
            />
          </div>
          <div>
            <label>Produto:</label>
            <input
              type="text"
              name="produto"
              value={testFormData.produto}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '5px' }}
            />
          </div>
          <div>
            <label>Cliente:</label>
            <input
              type="text"
              name="cliente"
              value={testFormData.cliente}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '5px' }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button 
          onClick={simulateSale}
          disabled={isLoading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          {isLoading ? 'Processando...' : '💰 Simular Venda'}
        </button>

        <button 
          onClick={testLocalNotification}
          style={{
            padding: '10px 20px',
            backgroundColor: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🔔 Testar Notificação Local
        </button>

        <button 
          onClick={checkActiveSubscriptions}
          style={{
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          📱 Ver Subscriptions Ativas
        </button>
      </div>

      {lastSale && (
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: '#d4edda', 
          border: '1px solid #c3e6cb',
          borderRadius: '4px' 
        }}>
          <h4>✅ Última Venda Inserida:</h4>
          <p><strong>ID:</strong> {lastSale.id}</p>
          <p><strong>Valor:</strong> R$ {lastSale.valor}</p>
          <p><strong>Produto:</strong> {lastSale.produto}</p>
          <p><strong>Cliente:</strong> {lastSale.cliente}</p>
          <p><strong>Data:</strong> {new Date(lastSale.created_at).toLocaleString('pt-BR')}</p>
        </div>
      )}

      <div style={{ 
        marginTop: '15px', 
        padding: '10px', 
        backgroundColor: '#e2e3e5', 
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        <strong>ℹ️ Como funciona:</strong>
        <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
          <li>Clique em "Simular Venda" para inserir uma venda na tabela</li>
          <li>O trigger automático do Supabase irá chamar a Edge Function</li>
          <li>A Edge Function enviará notificações push para todos os dispositivos registrados</li>
          <li>Você também verá uma notificação local pelo Real-time listener</li>
        </ul>
      </div>
    </div>
  )
}

export default SalesTestComponent