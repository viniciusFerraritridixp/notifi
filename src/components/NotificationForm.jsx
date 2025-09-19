import { useState } from 'react'

function NotificationForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: true,
    silent: false,
    urgency: 'normal'
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      alert('Título é obrigatório')
      return
    }

    // Enviar notificação
    const notification = new Notification(formData.title, {
      body: formData.body,
      icon: formData.icon,
      badge: formData.badge,
      vibrate: formData.vibrate ? [200, 100, 200] : [],
      silent: formData.silent,
      tag: `custom-${Date.now()}`
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }

    onSubmit({
      ...formData,
      type: 'custom'
    })
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  return (
    <div className="notification-form-overlay">
      <div className="notification-form">
        <h3>Nova Notificação Personalizada</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">Título *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Digite o título da notificação"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="body">Mensagem</label>
            <textarea
              id="body"
              name="body"
              value={formData.body}
              onChange={handleChange}
              placeholder="Digite a mensagem da notificação"
              rows="3"
            />
          </div>

          <div className="form-group">
            <label htmlFor="urgency">Urgência</label>
            <select
              id="urgency"
              name="urgency"
              value={formData.urgency}
              onChange={handleChange}
            >
              <option value="low">Baixa</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  name="vibrate"
                  checked={formData.vibrate}
                  onChange={handleChange}
                />
                Vibração
              </label>
            </div>

            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  name="silent"
                  checked={formData.silent}
                  onChange={handleChange}
                />
                Silenciosa
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Enviar Notificação
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default NotificationForm