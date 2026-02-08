export interface NoteTopic {
  topicName: string;
  content: string;
}

export interface NoteUnit {
  unitNumber: string;
  unitName: string;
  topics: NoteTopic[];
}

export interface GeneratedNotes {
  subject: string;
  course: string;
  language: string;
  detailLevel: string;
  units: NoteUnit[];
}

export type DetailLevel = "1" | "2" | "3" | "4";
export type Language = "English" | "Hinglish" | "Hindi";
