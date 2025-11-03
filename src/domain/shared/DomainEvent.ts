export abstract class DomainEvent {
  readonly occurredOn: Date;
  readonly eventId: string;

  constructor(eventId?: string) {
    this.occurredOn = new Date();
    this.eventId = eventId || this.generateEventId();
  }

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  abstract toPrimitives(): any;
}
