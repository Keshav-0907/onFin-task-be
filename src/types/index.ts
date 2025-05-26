interface BaseResponse {
  success: boolean;
  message: string;
}

export interface GetAllAreasResponse extends BaseResponse {
  data: Area[];
}

export interface Area {
  name: string;
  wiki_name: string;
  pinCode: number;
  isServed: boolean;
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  activeFrom: string;
}

export interface ServedAreaResponse extends BaseResponse {
  data?: Area[];
}

export interface AreaStatsRequest {
  pinCode: string;

}

export interface AreaStatsResponse extends BaseResponse {
  data?: AreaStats | WikiDataResponse | FallBackaData;
}

export interface AreaStats {
  avgOrderValue: number;
  avgDeliveryTime: number;
  deliveryDelay: number;
  dailyOrders: {
    date: string;
    orders: number;
  }[];
  appOpensHistory: {
    date: string;
    opens: number;
  }[];
  areaName: string;
}

interface WikiData {
  content_urls?: {
    desktop?: {
      page?: string;
      revisions?: string;
      edit?: string;
      talk?: string;
    };
    mobile?: {
      page?: string;
      revisions?: string;
      edit?: string;
      talk?: string;
    };
  };
  title?: string;
  displaytitle?: string;
  namespace?: {
    id?: number;
    text?: string;
  };
  wikibase_item?: string;
  titles?: {
    canonical?: string;
    normalized?: string;
    display?: string;
  };
  pageid?: number;
  thumbnail?: {
    source?: string;
    width?: number;
    height?: number;
  };
  originalimage?: {
    source?: string;
    width?: number;
    height?: number;
  };
  lang?: string;
  dir?: string;
  revision?: string;
  tid?: string;
  timestamp?: string;
  description?: string;
  description_source?: string;
  coordinates?: {
    lat?: number;
    lon?: number;
  };
  extract?: string;
  extract_html?: string;
  type?: string;
}

export interface WikiDataResponse {
  isLocked: boolean;
  pinCode: string;
  areaName: string;
  area_name: string;
  wikiData: WikiData;
}


export interface FallBackaData {
  isFallback: boolean,
  pinCode: string,
  areaName: string,
  populationDensity: number,
  medianHouseholdIncome: number,
  purchasingPower: number,
}


// Chat Interface

export interface AiChatRequest {
  message: string;
  pinCode?: string;
  chatHistory: {
    message: string;
    writer: string;
  }[];
  summary?: string;
}

export interface AiChatResponse extends BaseResponse {
  success: boolean;
  message: string;
  data?: {
    content: string;
  };
}

export interface SummariseChatHistoryRequest {
  chatHistory: {
    message: string;
    writer: string;
  }[];
}

export interface SummariseChatHistoryResponse extends BaseResponse {
  summary?: string;
}