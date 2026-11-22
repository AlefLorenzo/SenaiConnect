import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreatePostModal from '../components/CreatePostModal';

jest.mock('../components/Avatar', () => ({
  __esModule: true,
  default: () => <div data-testid="composer-avatar" />,
}));

const makeProps = (overrides = {}) => ({
  isOpen: true,
  onClose: jest.fn(),
  user: { id: 7, name: 'Usuário de teste' },
  content: '',
  onContentChange: jest.fn(),
  placeholder: 'No que você está pensando?',
  imagePreview: null,
  onRemoveImage: jest.fn(),
  onImageSelect: jest.fn(),
  onSubmit: jest.fn(),
  isSubmitting: false,
  ...overrides,
});

describe('CreatePostModal', () => {
  test('renders a dialog in the document portal and closes on request', () => {
    const props = makeProps();
    render(<CreatePostModal {...props} />);

    expect(screen.getByRole('dialog', { name: 'Criar publicação' })).toBeInTheDocument();
    expect(screen.getByLabelText('Texto da publicação')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Fechar criação de publicação'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  test('does not render when closed', () => {
    render(<CreatePostModal {...makeProps({ isOpen: false })} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('submits once the publication contains text', () => {
    const props = makeProps({ content: 'Minha publicação' });
    render(<CreatePostModal {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });
});
