const prefix = '[PulseLocal]'

export const logger = {
  info: (...messages: unknown[]) => {
    console.log(prefix, ...messages)
  },
  warn: (...messages: unknown[]) => {
    console.warn(prefix, ...messages)
  },
  error: (...messages: unknown[]) => {
    console.error(prefix, ...messages)
  }
}

