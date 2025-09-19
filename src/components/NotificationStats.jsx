function NotificationStats({ notifications }) {
  const totalNotifications = notifications.length
  const todayNotifications = notifications.filter(n => {
    const today = new Date().toDateString()
    return n.timestamp.toDateString() === today
  }).length

  const notificationsByType = notifications.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1
    return acc
  }, {})

  return (
    <div className="notification-stats">
      <h3>Estatísticas</h3>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{totalNotifications}</div>
          <div className="stat-label">Total de Notificações</div>
        </div>

        <div className="stat-card">
          <div className="stat-number">{todayNotifications}</div>
          <div className="stat-label">Hoje</div>
        </div>

        <div className="stat-card">
          <div className="stat-number">{notificationsByType.test || 0}</div>
          <div className="stat-label">Testes</div>
        </div>

        <div className="stat-card">
          <div className="stat-number">{notificationsByType.custom || 0}</div>
          <div className="stat-label">Personalizadas</div>
        </div>
      </div>

      {totalNotifications > 0 && (
        <div className="recent-activity">
          <h4>Atividade Recente</h4>
          <div className="activity-list">
            {notifications.slice(0, 3).map(notification => (
              <div key={notification.id} className="activity-item">
                <div className="activity-title">{notification.title}</div>
                <div className="activity-time">
                  {notification.timestamp.toLocaleString('pt-BR')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationStats