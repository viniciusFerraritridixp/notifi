import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Dashboard from './components/Dashboard'
import NotificationCenter from './components/NotificationCenter'
import Settings from './components/Settings'
import InstallPrompt from './components/InstallPrompt'
import ConfigurationCheck from './components/ConfigurationCheck'
import AutoRegisterDevice from './components/AutoRegisterDevice'
import ShowFcmToken from './components/ShowFcmToken'
import supabasePushService from './services/supabasePushService'
import './App.css'

function App() {
  const [notifications, setNotifications] = useState([])
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState('default')

  useEffect(() => {
    // Verificar suporte a notificações
    if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true)
      setPermission(Notification.permission)
      
      // Inicializar serviço Supabase de notificações
      initializeSupabaseNotifications()
    }
  }, [])

  const initializeSupabaseNotifications = async () => {
    try {
      // Inicializar o serviço de notificações Supabase
      await supabasePushService.initialize()
      
      console.log('Serviço Supabase de notificações inicializado')
    } catch (error) {
      console.error('Erro ao inicializar notificações Supabase:', error)
    }
  }

  const addNotification = (notification) => {
    const newNotification = {
      id: Date.now(),
      timestamp: new Date(),
      ...notification
    }
    setNotifications(prev => [newNotification, ...prev])
  }

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const clearAllNotifications = () => {
    setNotifications([])
  }

  return (
    <Router>
      <div className="app">
        <Header />
        <ConfigurationCheck />
        <main className="main-content">
          <InstallPrompt />
          <Routes>
            <Route 
              path="/" 
              element={
                <>
                  <Dashboard 
                    notifications={notifications}
                    isSupported={isSupported}
                    permission={permission}
                    onPermissionChange={setPermission}
                    onAddNotification={addNotification}
                  />
                  <AutoRegisterDevice />
                  <ShowFcmToken />
                </>
              } 
            />
            <Route 
              path="/notifications" 
              element={
                <NotificationCenter 
                  notifications={notifications}
                  onRemove={removeNotification}
                  onClearAll={clearAllNotifications}
                />
              } 
            />
            <Route 
              path="/settings" 
              element={
                <Settings 
                  isSupported={isSupported}
                  permission={permission}
                  onPermissionChange={setPermission}
                />
              } 
            />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App