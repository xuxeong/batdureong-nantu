// EventBus 구현. 계약은 events.ts 에 있고 여기는 배선만 한다.

import type {
  EventBus,
  SystemEventName,
  SystemEvents,
  UiRequestName,
  UiRequests,
  Unsubscribe,
} from './events.ts'

type AnyHandler = (payload: never) => void

function makeChannel() {
  const handlers = new Map<string, Set<AnyHandler>>()

  return {
    add(name: string, handler: AnyHandler): Unsubscribe {
      let set = handlers.get(name)
      if (!set) {
        set = new Set()
        handlers.set(name, set)
      }
      set.add(handler)
      return () => {
        set.delete(handler)
      }
    },

    send(name: string, payload: unknown): void {
      const set = handlers.get(name)
      if (!set) return
      // 핸들러가 처리 중에 구독을 해제할 수 있으므로 사본을 순회한다.
      for (const handler of [...set]) {
        ;(handler as (p: unknown) => void)(payload)
      }
    },
  }
}

export function createEventBus(): EventBus {
  const requests = makeChannel()
  const events = makeChannel()

  return {
    request<K extends UiRequestName>(name: K, payload: UiRequests[K]) {
      requests.send(name, payload)
    },
    onRequest<K extends UiRequestName>(name: K, handler: (payload: UiRequests[K]) => void) {
      return requests.add(name, handler as AnyHandler)
    },

    emit<K extends SystemEventName>(name: K, payload: SystemEvents[K]) {
      events.send(name, payload)
    },
    on<K extends SystemEventName>(name: K, handler: (payload: SystemEvents[K]) => void) {
      return events.add(name, handler as AnyHandler)
    },
  }
}
