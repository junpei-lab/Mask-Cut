export const INPUT_TEXT_MAX_LENGTH = 1000;

function clampDraftText(value: string): string {
  return value.length > INPUT_TEXT_MAX_LENGTH ? value.slice(0, INPUT_TEXT_MAX_LENGTH) : value;
}

export type BannerTone = 'info' | 'success' | 'error';

export type BannerState = {
  tone: BannerTone;
  message: string;
  errorCode?: string;
  showSettingsLink?: boolean;
};

export type ResultState = {
  text: string;
  model?: string;
  endpoint?: string;
};

export type AppState = {
  draftText: string;
  inputError?: string;
  locked: boolean;
  banner: BannerState;
  result?: ResultState;
  copyFeedback?: 'success' | 'error';
};

export type SubmissionResult = {
  accepted: boolean;
  payload?: { text: string };
  nextState: AppState;
};

export type MaskingStatusViewEvent = {
  jobId: string;
  state: 'queued' | 'running' | 'succeeded' | 'failed';
  message?: string;
  maskedText?: string;
  model?: string;
  endpoint?: string;
  errorCode?: string;
  locked?: boolean;
};

export function createInitialState(): AppState {
  return {
    draftText: '',
    locked: false,
    banner: {
      tone: 'info',
      message: 'テキストを入力してマスキングを開始してください',
    },
    copyFeedback: undefined,
  };
}

export function updateDraftValue(state: AppState, nextDraft: string): AppState {
  const limitedDraft = clampDraftText(nextDraft);
  if (state.draftText === limitedDraft && !state.inputError) {
    return state;
  }
  return {
    ...state,
    draftText: limitedDraft,
    ...(state.inputError ? { inputError: undefined } : {}),
  };
}

function withBanner(state: AppState, banner: BannerState): AppState {
  if (state.banner === banner) {
    return state;
  }
  return {
    ...state,
    banner,
  };
}

export function applySubmission(state: AppState, rawText: string): SubmissionResult {
  const limitedRawText = clampDraftText(rawText);
  const trimmed = limitedRawText.trim();
  if (!trimmed) {
    return {
      accepted: false,
      nextState: {
        ...state,
        draftText: limitedRawText,
        inputError: '入力が必要です',
        locked: false,
        banner: {
          tone: 'info',
          message: 'テキストを入力してからマスキングを実行してください',
        },
      },
    };
  }

  const banner: BannerState = {
    tone: 'info',
    message: 'マスキングを開始しています...',
  };

  return {
    accepted: true,
    payload: { text: trimmed },
    nextState: {
      ...state,
      draftText: limitedRawText,
      inputError: undefined,
      locked: true,
      banner,
    },
  };
}

export function applyStatusEvent(state: AppState, event: MaskingStatusViewEvent): AppState {
  switch (event.state) {
    case 'queued':
      return {
        ...state,
        locked: event.locked ?? true,
        banner: {
          tone: 'info',
          message: '実行待ちです...',
        },
        copyFeedback: undefined,
      };
    case 'running':
      return {
        ...state,
        locked: event.locked ?? true,
        banner: {
          tone: 'info',
          message: 'マスキング中...',
        },
        copyFeedback: undefined,
      };
    case 'succeeded': {
      const result: ResultState | undefined = event.maskedText
        ? {
            text: event.maskedText,
            model: event.model,
            endpoint: event.endpoint,
          }
        : state.result;
      return {
        ...state,
        locked: event.locked ?? false,
        result,
        banner: {
          tone: 'success',
          message: 'マスキングが完了しました',
        },
        copyFeedback: undefined,
      };
    }
    case 'failed': {
      const message = event.message ?? 'マスキングに失敗しました';
      return {
        ...state,
        locked: event.locked ?? false,
        banner: {
          tone: 'error',
          message,
          errorCode: event.errorCode,
          showSettingsLink: true,
        },
        copyFeedback: undefined,
      };
    }
    default:
      return state;
  }
}

export class AppStateStore {
  private state: AppState;

  private readonly listeners = new Set<(next: AppState) => void>();

  constructor(initialState: AppState = createInitialState()) {
    this.state = initialState;
  }

  getState(): AppState {
    return this.state;
  }

  setState(next: AppState): void {
    if (this.state === next) {
      return;
    }
    this.state = next;
    this.listeners.forEach((listener) => listener(this.state));
  }

  update(updater: (current: AppState) => AppState): void {
    this.setState(updater(this.state));
  }

  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export function markCopyFeedback(state: AppState, status: 'success' | 'error' | undefined): AppState {
  if (state.copyFeedback === status) {
    return state;
  }
  return {
    ...state,
    copyFeedback: status,
  };
}
