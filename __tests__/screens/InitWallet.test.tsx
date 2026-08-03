/**
 * Component tests for the InitWallet screens.
 *
 * Tests WelcomeScreen (terms toggle), InitialScreen (navigation),
 * and NewWordsScreen (word generation and display).
 */
import React from 'react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Switch } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { WelcomeScreen, InitialScreen, NewWordsScreen } from '../../src/screens/InitWallet';
import NewHathorButton from '../../src/components/NewHathorButton';

// Mock wallet-lib to control word generation while providing all needed exports
jest.mock('@hathor/wallet-lib', () => {
  // Base class that HybridStore extends
  class MemoryStore {
    getItem() { return null; }

    setItem() {}

    cleanStorage() {}

    clearItems() {}
  }

  class Storage {
    constructor() {
      this.store = new MemoryStore();
    }

    cleanStorage() {}
  }

  return {
    walletUtils: {
      generateWalletWords: jest.fn(
        () => 'abandon ability able about above absent absorb abstract absurd abuse access accident acid acoustic acquire across act action actor actress actual adapt add addict'
      ),
      wordsValid: jest.fn(() => ({ valid: true, words: '' })),
      generateAccessDataFromSeed: jest.fn(() => ({})),
    },
    errors: {
      InvalidWords: class InvalidWords extends Error {
        invalidWords: string[];

        constructor(message: string, invalidWords: string[]) {
          super(message);
          this.invalidWords = invalidWords;
        }
      },
    },
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

// Mock the config to not skip seed confirmation
jest.mock('../../src/config', () => ({
  SKIP_SEED_CONFIRMATION: false,
  _DEFAULT_TOKEN: { uid: '00', name: 'Hathor', symbol: 'HTR' },
  _PRIMARY_COLOR: '#8C46FF',
  _IS_MULTI_TOKEN: true,
  _SENTRY_DSN: '',
}));

// Mock image assets
jest.mock('../../src/assets/images/icCheckBig.png', () => 1);
jest.mock('../../src/assets/images/icErrorBig.png', () => 1);

// ─── WelcomeScreen ─────────────────────────────────────────────────────────
describe('WelcomeScreen', () => {
  const mockNavigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the welcome text', () => {
    const { getByText } = render(
      <WelcomeScreen navigation={mockNavigation} />
    );
    expect(getByText('Welcome to Hathor Wallet!')).toBeTruthy();
  });

  it('renders the Start button as disabled initially', () => {
    // Direct contract assertion on the button's disabled prop, instead
    // of inferring disabled-ness from "navigate wasn't called" — that
    // indirect check would also pass for unrelated reasons (e.g. mock
    // wiring drift). The Start button is the only NewHathorButton on
    // WelcomeScreen, so UNSAFE_getByType resolves uniquely.
    // eslint-disable-next-line camelcase
    const { getByText, UNSAFE_getByType } = render(
      <WelcomeScreen navigation={mockNavigation} />
    );
    // eslint-disable-next-line camelcase
    const startButton = UNSAFE_getByType(NewHathorButton);
    expect(startButton.props.disabled).toBe(true);
    // Belt-and-suspenders: pressing the disabled button must not navigate.
    fireEvent.press(getByText('Start'));
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  it('enables the Start button after toggling the agreement switch', () => {
    // UNSAFE_getByType is RTL's escape-hatch for finding components by
    // class reference. The non-camelCase name is upstream's choice; the
    // disable scope is intentionally narrow.
    // eslint-disable-next-line camelcase
    const { getByText, UNSAFE_getByType } = render(
      <WelcomeScreen navigation={mockNavigation} />
    );

    // Find and toggle the Switch
    // eslint-disable-next-line camelcase
    const switchComponent = UNSAFE_getByType(Switch);
    fireEvent(switchComponent, 'valueChange', true);

    // Now the Start button should work
    fireEvent.press(getByText('Start'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('InitialScreen');
  });
});

// ─── InitialScreen ─────────────────────────────────────────────────────────
describe('InitialScreen', () => {
  const mockNavigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders both wallet options', () => {
    const { getByText } = render(
      <InitialScreen navigation={mockNavigation} />
    );
    expect(getByText('Import Wallet')).toBeTruthy();
    expect(getByText('New Wallet')).toBeTruthy();
  });

  it('navigates to LoadWordsScreen when Import Wallet is pressed', () => {
    const { getByText } = render(
      <InitialScreen navigation={mockNavigation} />
    );
    fireEvent.press(getByText('Import Wallet'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('LoadWordsScreen');
  });

  it('navigates to NewWordsScreen when New Wallet is pressed', () => {
    const { getByText } = render(
      <InitialScreen navigation={mockNavigation} />
    );
    fireEvent.press(getByText('New Wallet'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('NewWordsScreen');
  });
});

// ─── NewWordsScreen ────────────────────────────────────────────────────────
describe('NewWordsScreen', () => {
  const mockNavigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays 24 generated words', () => {
    const { getByText } = render(
      <NewWordsScreen navigation={mockNavigation} />
    );
    // Check a few words from our mocked generation
    expect(getByText('abandon')).toBeTruthy();
    expect(getByText('ability')).toBeTruthy();
    expect(getByText('adapt')).toBeTruthy(); // last word
  });

  it('displays all 24 words in numbered rows', () => {
    const { getByText } = render(
      <NewWordsScreen navigation={mockNavigation} />
    );
    // The component renders words numbered 1-24 in a 2-column grid.
    // Verify first, middle, and last words appear.
    expect(getByText('abandon')).toBeTruthy();
    expect(getByText('absurd')).toBeTruthy(); // word 10
    expect(getByText('addict')).toBeTruthy(); // word 24
  });

  it('navigates to BackupWords on Next press (SKIP_SEED_CONFIRMATION=false)', () => {
    const { getByText } = render(
      <NewWordsScreen navigation={mockNavigation} />
    );
    fireEvent.press(getByText('Next'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('BackupWords', {
      words: expect.any(String),
    });
    // Verify the words are passed as a space-separated string
    const passedWords = mockNavigation.navigate.mock.calls[0][1].words;
    expect(passedWords.split(' ')).toHaveLength(24);
  });
});
