import { runSwissSimulation, type SimulationInput } from './simulation'

self.onmessage = (event: MessageEvent<SimulationInput>) => {
  try {
    const result = runSwissSimulation(event.data, done => self.postMessage({ type: 'progress', done }))
    self.postMessage({ type: 'complete', result })
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : '模拟失败，请减少规模后重试。' })
  }
}
