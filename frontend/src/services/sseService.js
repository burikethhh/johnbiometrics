const SSE_URL = '';

class SSEService {
  constructor() {
    this.eventSource = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
  }

  connect() {
    if (this.eventSource) {
      this.eventSource.close();
    }

    const token = localStorage.getItem('token');
    const url = token
      ? `${SSE_URL}/api/sse?token=${token}`
      : `${SSE_URL}/api/sse`;

    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.reconnectAttempts = 0;

        if (data.type === 'new-verification') {
          this.emit('new-verification', data.data);
        } else if (data.type === 'connected') {
          this.emit('connected', data);
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    this.eventSource.onerror = () => {
      this.eventSource.close();
      this.emit('disconnected');

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
      }
    };
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.reconnectAttempts = 0;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const cbs = this.listeners.get(event);
    if (cbs) {
      const index = cbs.indexOf(callback);
      if (index > -1) cbs.splice(index, 1);
    }
  }

  emit(event, data) {
    const cbs = this.listeners.get(event);
    if (cbs) {
      cbs.forEach(cb => cb(data));
    }
  }
}

const sseService = new SSEService();
export default sseService;
