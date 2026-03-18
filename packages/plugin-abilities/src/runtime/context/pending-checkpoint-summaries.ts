const GLOBAL_SESSION_KEY = '__global__'

export class PendingCheckpointSummaries {
  private bySession = new Map<string, string>()

  put(sessionID: string | undefined, summary: string): void {
    if (summary.trim().length === 0) return
    this.bySession.set(this.key(sessionID), summary)
  }

  consume(sessionID: string | undefined): string | undefined {
    const sessionKey = this.key(sessionID)
    const scoped = this.bySession.get(sessionKey)
    if (scoped) {
      this.bySession.delete(sessionKey)
      return scoped
    }

    const global = this.bySession.get(GLOBAL_SESSION_KEY)
    if (global) {
      this.bySession.delete(GLOBAL_SESSION_KEY)
      return global
    }

    return undefined
  }

  clear(sessionID: string | undefined): void {
    this.bySession.delete(this.key(sessionID))
  }

  private key(sessionID: string | undefined): string {
    if (typeof sessionID === 'string' && sessionID.length > 0) {
      return sessionID
    }
    return GLOBAL_SESSION_KEY
  }
}
