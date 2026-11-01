import 'dotenv/config';
import { Kafka, logLevel, Partitioners, Producer, Consumer } from 'kafkajs';

const brokers = process.env.KAFKA_BROKERS
  ? process.env.KAFKA_BROKERS.split(',').map((broker) => broker.trim()).filter(Boolean)
  : [];
const username = process.env.KAFKA_SASL_USERNAME;
const password = process.env.KAFKA_SASL_PASSWORD;
const useSsl = process.env.KAFKA_USE_SSL === 'true';
const sslCa = process.env.KAFKA_SSL_CA?.replace(/\\n/g, '\n');
const rejectUnauthorized = process.env.KAFKA_SSL_REJECT_UNAUTHORIZED !== 'false';
const retryCount = Math.max(0, Number(process.env.KAFKA_RETRY_COUNT || 8));

export const isKafkaConfigured = brokers.length > 0;

let kafkaInstance: Kafka | null = null;
let producerInstance: Producer | null = null;

if (isKafkaConfigured) {
  kafkaInstance = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || 'panelflow-backend',
    brokers,
    ssl: useSsl ? {
      ca: sslCa ? [sslCa] : undefined,
      rejectUnauthorized,
    } : false,
    sasl: username && password ? {
      mechanism: 'scram-sha-256',
      username,
      password,
    } : undefined,
    retry: {
      retries: retryCount,
      initialRetryTime: 300,
      maxRetryTime: 30_000,
    },
    logLevel: logLevel.WARN,
  });

  producerInstance = kafkaInstance.producer({
    createPartitioner: Partitioners.DefaultPartitioner,
    allowAutoTopicCreation: true,
  });
}

export const kafka = kafkaInstance;
export const kafkaProducer = producerInstance;
