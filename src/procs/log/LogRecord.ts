// OTel-compatible structured log record (JSON output shape).
export type LogRecord = {
    Timestamp: string;                          // ISO 8601
    SeverityNumber: number;                     // OTel: DEBUG=5, INFO=9, WARN=13, ERROR=17
    SeverityText: string;                       // DEBUG | INFO | WARN | ERROR
    Body: string;                               // human-readable message
    Attributes: Record<string, any>;            // structured key-value data
    Resource: { "service.name": string };
    TraceId?: string;
    SpanId?: string;
};
