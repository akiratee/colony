// Colony Types

export interface Message {
  id: string;
  content: string;
  channelId: string;
  author: {
    name: string;
    avatar?: string;
    isBot?: boolean;
  };
  timestamp: Date;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
}

export interface Bot {
  id: string;
  name: string;
  description: string;
  avatar: string;
  status: 'online' | 'offline';
  instructions?: string;
  apiEndpoint?: string;
}

export interface User {
  id: string;
  name: string;
  avatar?: string;
}
