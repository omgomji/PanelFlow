export interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactPayload {
  name: string;
  email: string;
  phone?: string;
  note?: string;
}
