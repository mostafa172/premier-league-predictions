/* filepath: frontend/src/app/models/team.model.ts */
export interface Team {
    id: number;
    name: string;
    abbreviation: string;
    logoUrl?: string;
    colorPrimary?: string;
    colorSecondary?: string;
    foundedYear?: number;
    stadium?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }