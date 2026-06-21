export interface ExternalPlaylist {
  id: string;
  name: string;
  description?: string;
  curatorName?: string;
  owner?: string;
  provider: string;
  externalId: string;
  trackCount: number;
  duration?: number;
  coverUrl?: string;
  coverArt?: string;
  url?: string;
  isPublic?: boolean;
  createdDate?: string;
}
