import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock lastfm's searchArtist to avoid real API calls
vi.mock('@/lib/lastfm', () => ({
  searchArtist: vi.fn().mockResolvedValue([]),
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial, animate, exit, transition, ...rest } = props;
      void initial; void animate; void exit; void transition;
      return <div {...rest}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

import SearchBar from '@/components/search-bar';
import { searchArtist } from '@/lib/lastfm';

describe('SearchBar', () => {
  const mockOnSearch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the search input', () => {
    render(<SearchBar onSearch={mockOnSearch} />);
    expect(
      screen.getByPlaceholderText('Search for an artist...')
    ).toBeInTheDocument();
  });

  it('calls onSearch when form is submitted with text', async () => {
    const user = userEvent.setup();
    render(<SearchBar onSearch={mockOnSearch} />);

    const input = screen.getByPlaceholderText('Search for an artist...');
    await user.type(input, 'Radiohead');
    await user.keyboard('{Enter}');

    expect(mockOnSearch).toHaveBeenCalledWith('Radiohead');
  });

  it('does not call onSearch when submitting empty input', async () => {
    const user = userEvent.setup();
    render(<SearchBar onSearch={mockOnSearch} />);

    const input = screen.getByPlaceholderText('Search for an artist...');
    await user.click(input);
    await user.keyboard('{Enter}');

    expect(mockOnSearch).not.toHaveBeenCalled();
  });

  it('shows clear button when text is entered', async () => {
    const user = userEvent.setup();
    render(<SearchBar onSearch={mockOnSearch} />);

    const input = screen.getByPlaceholderText('Search for an artist...');
    await user.type(input, 'test');

    // The X button should appear
    const clearButton = screen.getByRole('button');
    expect(clearButton).toBeInTheDocument();
  });

  it('clears input when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(<SearchBar onSearch={mockOnSearch} />);

    const input = screen.getByPlaceholderText(
      'Search for an artist...'
    ) as HTMLInputElement;
    await user.type(input, 'test');
    expect(input.value).toBe('test');

    const clearButton = screen.getByRole('button');
    await user.click(clearButton);
    expect(input.value).toBe('');
  });

  it('disables input when isLoading is true', () => {
    render(<SearchBar onSearch={mockOnSearch} isLoading={true} />);

    const input = screen.getByPlaceholderText('Search for an artist...');
    expect(input).toBeDisabled();
  });

  it('shows suggestions when searchArtist returns results', async () => {
    const user = userEvent.setup();
    const mockResults = [
      { id: '1', name: 'Radiohead', url: 'http://example.com' },
      { id: '2', name: 'Radio Moscow', url: 'http://example.com' },
    ];
    (searchArtist as ReturnType<typeof vi.fn>).mockResolvedValue(mockResults);

    render(<SearchBar onSearch={mockOnSearch} />);

    const input = screen.getByPlaceholderText('Search for an artist...');
    await user.type(input, 'Radio');

    // Wait for debounce (300ms) + async resolution
    await vi.waitFor(
      () => {
        expect(screen.getByText('Radiohead')).toBeInTheDocument();
        expect(screen.getByText('Radio Moscow')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });

  it('calls onSearch when a suggestion is clicked', async () => {
    const user = userEvent.setup();
    const mockResults = [
      { id: '1', name: 'Radiohead', url: 'http://example.com' },
    ];
    (searchArtist as ReturnType<typeof vi.fn>).mockResolvedValue(mockResults);

    render(<SearchBar onSearch={mockOnSearch} />);

    const input = screen.getByPlaceholderText('Search for an artist...');
    await user.type(input, 'Radio');

    await vi.waitFor(
      () => {
        expect(screen.getByText('Radiohead')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    await user.click(screen.getByText('Radiohead'));
    expect(mockOnSearch).toHaveBeenCalledWith('Radiohead');
  });

  it('resets state when resetSignal changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <SearchBar onSearch={mockOnSearch} resetSignal={0} />
    );

    const input = screen.getByPlaceholderText(
      'Search for an artist...'
    ) as HTMLInputElement;
    await user.type(input, 'test');
    expect(input.value).toBe('test');

    rerender(<SearchBar onSearch={mockOnSearch} resetSignal={1} />);

    await vi.waitFor(() => {
      expect(input.value).toBe('');
    });
  });
});
