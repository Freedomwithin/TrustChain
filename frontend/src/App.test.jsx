
import { render, screen } from '@testing-library/react';
import App, { getStatusDisplay, TRUSTED_THRESHOLD, PROBATIONARY_THRESHOLD } from './App';

test('renders TrustChain header', () => {
  render(<App />);
  const linkElement = screen.getAllByText(/TrustChain/i)[0];
  expect(linkElement).toBeInTheDocument();
});

describe('getStatusDisplay', () => {
    test('returns ERROR for null/undefined/NaN scores', () => {
        expect(getStatusDisplay(undefined, null)).toEqual({ label: 'ERROR', color: 'red' });
        expect(getStatusDisplay(undefined, undefined)).toEqual({ label: 'ERROR', color: 'red' });
        expect(getStatusDisplay(undefined, NaN)).toEqual({ label: 'ERROR', color: 'red' });
        expect(getStatusDisplay('ERROR', 0.5)).toEqual({ label: 'ERROR', color: 'red' });
    });

    test('returns PROBATIONARY for specific status', () => {
        expect(getStatusDisplay('PROBATIONARY', 0.5)).toEqual({ label: 'PROBATIONARY ⚠️', color: 'orange' });
    });

    test('returns TRUSTED ACTOR for scores below threshold', () => {
        expect(getStatusDisplay('OK', TRUSTED_THRESHOLD - 0.01)).toEqual({ label: 'TRUSTED ACTOR ✓', color: 'green' });
    });

    test('returns PROBATIONARY for scores below probationary threshold', () => {
         expect(getStatusDisplay('OK', PROBATIONARY_THRESHOLD)).toEqual({ label: 'PROBATIONARY ⚠️', color: 'orange' });
         expect(getStatusDisplay('OK', TRUSTED_THRESHOLD)).toEqual({ label: 'PROBATIONARY ⚠️', color: 'orange' });
    });

    test('returns POTENTIAL SYBIL for high scores', () => {
        expect(getStatusDisplay('OK', PROBATIONARY_THRESHOLD + 0.1)).toEqual({ label: 'POTENTIAL SYBIL 🚨', color: 'red' });
    });
});
