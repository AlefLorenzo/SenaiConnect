import React, { useContext, useEffect, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { AuthContext } from '../context/AuthContext';
import { StoryViewerContext } from '../context/StoryViewerContext';
import { SocketContext } from '../context/SocketContext';

jest.mock('../components/MobileBottomNav', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('nav', { 'data-testid': 'mobile-bottom-nav' }),
  };
});

const StoryViewerMock = ({ onClose }) => {
  const { setStoryViewerOpen } = useContext(StoryViewerContext);

  useEffect(() => {
    setStoryViewerOpen(true);
    return () => setStoryViewerOpen(false);
  }, [setStoryViewerOpen]);

  return (
    <section role="dialog" aria-label="Visualizador de stories">
      <button type="button" onClick={onClose}>Fechar story</button>
    </section>
  );
};

const StoryHarness = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>Abrir story</button>
      {isOpen && <StoryViewerMock onClose={() => setIsOpen(false)} />}
    </>
  );
};

describe('AppLayout story navigation behavior', () => {
  const renderLayout = () => render(
    <MemoryRouter initialEntries={['/']}>
      <AuthContext.Provider value={{ user: { id: 1 } }}>
        <SocketContext.Provider value={{
          fetchUnreadCount: jest.fn(),
          fetchUnreadMessagesCount: jest.fn(),
        }}>
          <AppLayout>
            <StoryHarness />
          </AppLayout>
        </SocketContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  );

  test('hides the bottom navigation while a story is open and restores it after closing', () => {
    renderLayout();

    expect(screen.getByTestId('mobile-bottom-nav')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir story' }));

    expect(screen.getByRole('dialog', { name: 'Visualizador de stories' })).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-bottom-nav')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Fechar story' }));

    expect(screen.queryByRole('dialog', { name: 'Visualizador de stories' })).not.toBeInTheDocument();
    expect(screen.getByTestId('mobile-bottom-nav')).toBeInTheDocument();
  });
});
