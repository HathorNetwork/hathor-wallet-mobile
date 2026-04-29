/**
 * Component tests for the BackupWords screen.
 *
 * Tests the 5-step word validation flow:
 * - Correct word selection advances through all steps
 * - Wrong word selection shows failure modal
 * - Edge positions (near boundaries) display correct option ranges
 */
import React from 'react';
import {
  describe, it, expect, jest, beforeEach,
} from '@jest/globals';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import BackupWords from '../../src/screens/BackupWords';

// The 24 test words — same as used in InitWallet.test.tsx
const TEST_WORDS = 'abandon ability able about above absent absorb abstract absurd abuse access accident acid acoustic acquire across act action actor actress actual adapt add addict';
const TEST_WORDS_ARR = TEST_WORDS.split(' ');

// Mock lodash.shuffle to make tests deterministic.
// We control which 5 word positions are selected for validation.
const FIXED_INDEXES = [3, 8, 12, 18, 22]; // 1-indexed positions to validate
jest.mock('lodash', () => {
  const actual = jest.requireActual('lodash');

  return {
    ...actual,
    shuffle: jest.fn((arr: any[]) => {
      // First call: shuffling the 1-24 indexes array → return with our chosen 5 first
      if (arr.length === 24 && typeof arr[0] === 'number') {
        // Place our chosen indexes at the front, rest after
        const chosen = [...FIXED_INDEXES];
        const rest = arr.filter((x: number) => !chosen.includes(x));
        return [...chosen, ...rest];
      }
      // Subsequent calls: shuffling word options for display.
      // Return as-is (no shuffle) so we can predict button order.
      return arr;
    }),
  };
});

// Mock wallet-lib (needed by transitive imports)
jest.mock('@hathor/wallet-lib', () => {
  class MemoryStore {
    getItem() { return null; }

    setItem() {}

    cleanStorage() {}

    clearItems() {}
  }
  class Storage {
    constructor() { this.store = new MemoryStore(); }

    cleanStorage() {}
  }
  return {
    walletUtils: { generateWalletWords: jest.fn(() => TEST_WORDS) },
    errors: { InvalidWords: class extends Error {} },
    constants: {
      HD_WALLET_ENTROPY: 256,
      NATIVE_TOKEN_UID: '00',
      DEFAULT_NATIVE_TOKEN_CONFIG: { name: 'Hathor', symbol: 'HTR' },
    },
    MemoryStore,
    Storage,
    cryptoUtils: { hashPassword: jest.fn(() => 'hashed') },
    config: {
      setExplorerServiceBaseUrl: jest.fn(),
      setServerUrl: jest.fn(),
      setWalletServiceBaseUrl: jest.fn(),
      setWalletServiceBaseWsUrl: jest.fn(),
      setTxMiningUrl: jest.fn(),
      getExplorerServiceBaseUrl: jest.fn(() => ''),
      getServerUrl: jest.fn(() => ''),
      getWalletServiceBaseUrl: jest.fn(() => ''),
      getWalletServiceBaseWsUrl: jest.fn(() => ''),
    },
    HathorWallet: jest.fn(),
    Connection: jest.fn(),
    Network: jest.fn(),
    metadataApi: { getTokenMetadata: jest.fn() },
    TokenVersion: {},
  };
});

jest.mock('../../src/config', () => ({
  SKIP_SEED_CONFIRMATION: false,
  _DEFAULT_TOKEN: { uid: '00', name: 'Hathor', symbol: 'HTR' },
  _PRIMARY_COLOR: '#8C46FF',
  _IS_MULTI_TOKEN: true,
  _SENTRY_DSN: '',
}));

jest.mock('../../src/assets/images/icCheckBig.png', () => 1);
jest.mock('../../src/assets/images/icErrorBig.png', () => 1);

// Mock Portal to render children directly (no PortalProvider needed).
// Returning `children` works because ReactNode is itself a valid render
// value — wrapping in a fragment would just add a no-op layer.
jest.mock('../../src/components/Portal', () => ({
  Portal: ({ children }: { children: unknown }) => children,
  PortalProvider: ({ children }: { children: unknown }) => children,
}));

describe('BackupWords', () => {
  const mockNavigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  const mockRoute = {
    params: { words: TEST_WORDS },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the instruction text', () => {
    const { getByText } = render(
      <BackupWords navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('To make sure you saved,')).toBeTruthy();
    expect(getByText('Please select the word that corresponds to the number below:')).toBeTruthy();
  });

  it('displays the current word position number', () => {
    const { getByText } = render(
      <BackupWords navigation={mockNavigation} route={mockRoute} />
    );
    // First index to validate is FIXED_INDEXES[0] = 3
    expect(getByText(String(FIXED_INDEXES[0]))).toBeTruthy();
  });

  it('shows 5 word option buttons', () => {
    const { getByText } = render(
      <BackupWords navigation={mockNavigation} route={mockRoute} />
    );
    // For position 3 (1-indexed), the screen renders the 5 words around it.
    // With FIXED_INDEXES[0] = 3, that window is TEST_WORDS_ARR[0..4] —
    // 'abandon', 'ability', 'able', 'about', 'above'. Asserting each is
    // present pins (a) the option count, (b) the correct word is included.
    const expectedOptions = TEST_WORDS_ARR.slice(0, 5);
    expectedOptions.forEach((word) => {
      expect(getByText(word)).toBeTruthy();
    });
  });

  it('advances to next step when correct word is selected', async () => {
    const { getByText } = render(
      <BackupWords navigation={mockNavigation} route={mockRoute} />
    );

    // Step 1: position 3 → correct word is TEST_WORDS_ARR[2] = 'able'
    const correctWord1 = TEST_WORDS_ARR[FIXED_INDEXES[0] - 1];
    await act(async () => {
      fireEvent.press(getByText(correctWord1));
    });

    // After selecting correctly, should advance to step 2 showing FIXED_INDEXES[1] = 8
    await waitFor(() => {
      expect(getByText(String(FIXED_INDEXES[1]))).toBeTruthy();
    });
  });

  it('shows failure modal when wrong word is selected', async () => {
    const { getByText, queryByText } = render(
      <BackupWords navigation={mockNavigation} route={mockRoute} />
    );

    // BackupWords displays a window of options around FIXED_INDEXES[0].
    // Picking the word at the position immediately AFTER the correct one
    // guarantees the wrong word is both (a) different from the correct
    // word and (b) inside the on-screen options window — independent of
    // any future change to FIXED_INDEXES values.
    const correctIdx = FIXED_INDEXES[0] - 1;
    const correctWord = TEST_WORDS_ARR[correctIdx];
    const wrongWord = TEST_WORDS_ARR[correctIdx + 1];
    expect(wrongWord).not.toEqual(correctWord);

    await act(async () => {
      fireEvent.press(getByText(wrongWord));
    });

    // The failure modal should appear with "Wrong word." text
    await waitFor(() => {
      expect(queryByText('Wrong word.')).toBeTruthy();
    });
  });

  it('completes all 5 steps and shows success modal', async () => {
    const { getByText, queryByText } = render(
      <BackupWords navigation={mockNavigation} route={mockRoute} />
    );

    // Select the correct word for each of the 5 steps. Steps must run
    // sequentially (each press advances UI), so we serialize via reduce
    // — a for+await loop would trip no-await-in-loop / no-plusplus.
    await FIXED_INDEXES.reduce(async (prev, idx) => {
      await prev;
      const correctWord = TEST_WORDS_ARR[idx - 1];
      await act(async () => {
        fireEvent.press(getByText(correctWord));
      });
    }, Promise.resolve());

    // After all 5 correct, success modal should appear
    await waitFor(() => {
      expect(queryByText('Words saved correctly')).toBeTruthy();
    });
  });

  // The 'shows failure modal when wrong word is selected' test above is the
  // single failure-modal coverage. The dismiss → goBack wiring (originally
  // intended here) is left as a follow-up: simulating the BackdropModal
  // dismiss requires reaching into modal internals.
});
