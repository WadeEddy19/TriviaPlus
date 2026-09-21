export interface QuizAnswer {
  display: string;
  aliases: string[];
  hint?: string;
}

export interface Quiz {
  schemaVersion: 1;
  title: string;
  description: string;
  timeLimitSeconds: number;
  answerLabel: string;
  hintLabel?: string;
  answers: QuizAnswer[];
}

export interface StoredQuiz extends Quiz {
  id: string;
  createdAt: number;
}

export type RoomStatus = 'lobby' | 'playing' | 'ended';

export interface RoomMeta {
  hostUid: string;
  status: RoomStatus;
  createdAt: number;
  quizId?: string;
  title?: string;
  description?: string;
  answerLabel?: string;
  hintLabel?: string;
  timeLimitSeconds?: number;
  slotCount?: number;
  startedAt?: number;
  endedAt?: number;
}

export interface Player {
  uid: string;
  name: string;
  color: string;
  joinedAt: number;
  connected: boolean;
}

export interface Slot {
  hint?: string;
  hashes: string[];
}

export interface Found {
  uid: string;
  at: number;
  typed: string;
  display: string;
}

export interface Miss {
  id: string;
  uid: string;
  text: string;
  at: number;
}
