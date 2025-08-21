// Función de prueba para notificaciones - Solo para desarrollo
// Puedes ejecutar esta función en la consola del navegador para probar las notificaciones

export const testNotifications = () => {
  // Importar el hook (esto es solo para propósitos de prueba)
  import('./hooks/useNotifications.js').then(module => {
    const { useNotifications } = module;
    const { sendGoalNotification, sendMatchStatusNotification } = useNotifications();
    
    console.log('🔔 Probando notificaciones...');
    
    // Probar notificación de gol
    setTimeout(() => {
      sendGoalNotification('Juan Pérez', 'Primero A', 'futbol');
    }, 1000);
    
    // Probar notificación de estado
    setTimeout(() => {
      sendMatchStatusNotification('en curso', {
        equipoA: 'Primero A',
        equipoB: 'Segundo B'
      });
    }, 3000);
    
    // Probar notificación de básquet
    setTimeout(() => {
      sendGoalNotification('María González', 'Tercero C', 'basquet');
    }, 5000);
    
    console.log('✅ Notificaciones de prueba programadas');
  });
};

// Para usar en la consola del navegador:
// testNotifications();
