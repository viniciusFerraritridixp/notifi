function NotificationCenter({ notifications, onRemove, onClearAll }) {
  const formatTime = (timestamp) => {
    return timestamp.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'test':
        return '🧪'
      case 'custom':
        return '⚡'
      default:
        return '🔔'
    }
  }

  const getTypeLabel = (type) => {
    switch (type) {
      case 'test':
        return 'Teste'
      case 'custom':
        return 'Personalizada'
      default:
        return 'Sistema'
    }
  }

  if (notifications.length === 0) {
    return (
      <div className="notification-center">
        <div className="notification-center-header">
          <h2>Central de Notificações</h2>
          <p>Histórico de todas as notificações enviadas</p>
        </div>
        
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>Nenhuma notificação ainda</h3>
          <p>As notificações que você enviar aparecerão aqui</p>
        </div>
      </div>
    )
  }

  return (
    <div className="notification-center">
      <div className="notification-center-header">
        <h2>Central de Notificações</h2>
        <p>Histórico de todas as notificações enviadas</p>
        
        <div className="header-actions">
          <span className="notification-count">
            {notifications.length} notificação{notifications.length !== 1 ? 'ões' : ''}
          </span>
          <button 
            className="btn btn-outline"
            onClick={onClearAll}
          >
            Limpar Tudo
          </button>
        </div>
      </div>

      <div className="notification-list">
        {notifications.map(notification => (
          <div key={notification.id} className="notification-item">
            <div className="notification-content">
              <div className="notification-header">
                <div className="notification-type">
                  <span className="type-icon">{getTypeIcon(notification.type)}</span>
                  <span className="type-label">{getTypeLabel(notification.type)}</span>
                </div>
                <div className="notification-time">
                  {formatTime(notification.timestamp)}
                </div>
              </div>
              
              <div className="notification-body">
                <h4 className="notification-title">{notification.title}</h4>
                {notification.body && (
                  <p className="notification-message">{notification.body}</p>
                )}
              </div>
            </div>
            
            <button 
              className="btn-remove"
              onClick={() => onRemove(notification.id)}
              aria-label="Remover notificação"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default NotificationCenter