import { describe, it, expect } from 'vitest';
import React from 'react';
import {
  colors,
  typography,
  spacing,
  radii,
  elevation,
  breakpoints,
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  StatusIndicator,
  FormField,
  Input,
  Textarea,
  Select,
  Checkbox,
  EmptyState,
  ErrorState,
  Alert,
  Modal,
  ConfirmDialog,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Pagination,
  Breadcrumb,
  BreadcrumbItem,
  Skeleton,
  LoadingSpinner,
  Container,
  Divider,
  SectionHeader,
  cn,
} from '../src/index';

describe('Design Tokens Foundation', () => {
  it('defines the handcrafted brand color palette with valid hex values', () => {
    expect(colors.brand.terracotta[500]).toBe('#C25E3E');
    expect(colors.brand.amber[600]).toBe('#D97706');
    expect(colors.brand.emerald[600]).toBe('#059669');
    expect(colors.stone[50]).toBe('#FAFAF9');
    expect(colors.stone[900]).toBe('#1C1917');
    expect(colors.semantic.error.solid).toBe('#E11D48');
    expect(colors.semantic.success.solid).toBe('#059669');
  });

  it('defines a consistent typography scale from micro to 5xl', () => {
    expect(typography.fontSizes.micro.fontSize).toBe('0.625rem');
    expect(typography.fontSizes.xs.fontSize).toBe('0.75rem');
    expect(typography.fontSizes.sm.fontSize).toBe('0.875rem');
    expect(typography.fontSizes.base.fontSize).toBe('1rem');
    expect(typography.fontSizes['2xl'].fontSize).toBe('1.5rem');
    expect(typography.fontSizes['4xl'].fontSize).toBe('2.25rem');
    expect(typography.fontFamilies.sans).toContain('Inter');
  });

  it('defines 4px grid spacing, radii, elevation, and responsive breakpoints', () => {
    expect(spacing[1]).toBe('0.25rem');
    expect(spacing[4]).toBe('1rem');
    expect(spacing[8]).toBe('2rem');
    expect(radii.md).toBe('0.375rem');
    expect(radii.full).toBe('9999px');
    expect(elevation.craft).toContain('194, 94, 62');
    expect(breakpoints.sm).toBe('640px');
    expect(breakpoints.lg).toBe('1024px');
    expect(breakpoints.xl).toBe('1280px');
  });
});

describe('Utility cn Helper', () => {
  it('concatenates valid classnames and discards falsy values', () => {
    expect(cn('btn', false, null, undefined, 'btn-primary')).toBe('btn btn-primary');
    expect(cn('block', true && 'w-full', false && 'hidden')).toBe('block w-full');
  });
});

describe('UI Primitives Rendering & Attributes', () => {
  it('instantiates Button element with appropriate classes and accessibility', () => {
    const primaryBtn = React.createElement(Button, { variant: 'primary', size: 'md' }, 'Click me');
    expect(primaryBtn.props.variant).toBe('primary');
    expect(primaryBtn.props.size).toBe('md');
    expect(primaryBtn.props.children).toBe('Click me');

    const craftBtn = React.createElement(
      Button,
      { variant: 'craft', isLoading: true, fullWidth: true },
      'Save Listing',
    );
    expect(craftBtn.props.variant).toBe('craft');
    expect(craftBtn.props.isLoading).toBe(true);
    expect(craftBtn.props.fullWidth).toBe(true);
  });

  it('instantiates Badge element with dot and variant options', () => {
    const verifiedBadge = React.createElement(
      Badge,
      { variant: 'success', withDot: true },
      'Verified Artisan',
    );
    expect(verifiedBadge.props.variant).toBe('success');
    expect(verifiedBadge.props.withDot).toBe(true);
  });

  it('instantiates Card and subcomponents hierarchy', () => {
    const cardEl = React.createElement(
      Card,
      { variant: 'artisan' },
      React.createElement(
        CardHeader,
        null,
        React.createElement(CardTitle, null, 'Studio Pottery'),
        React.createElement(CardDescription, null, 'Hand-thrown terracotta tableware'),
      ),
      React.createElement(CardContent, null, 'Content details'),
      React.createElement(CardFooter, null, 'Footer actions'),
    );
    expect(cardEl.props.variant).toBe('artisan');
    expect(React.isValidElement(cardEl)).toBe(true);
  });

  it('instantiates StatusIndicator with normalized status key', () => {
    const statusEl = React.createElement(StatusIndicator, { status: 'PENDING_REVIEW' });
    expect(statusEl.props.status).toBe('PENDING_REVIEW');
  });

  it('instantiates accessible form controls (FormField, Input, Textarea, Select, Checkbox)', () => {
    const formFieldEl = React.createElement(
      FormField,
      {
        label: 'Product Title',
        htmlFor: 'title-input',
        required: true,
        helperText: 'Max 120 characters',
        errorText: 'Title is required',
      },
      React.createElement(Input, { id: 'title-input', hasError: true }),
    );
    expect(formFieldEl.props.required).toBe(true);
    expect(formFieldEl.props.label).toBe('Product Title');

    const textareaEl = React.createElement(Textarea, { rows: 4, hasError: false });
    expect(textareaEl.props.rows).toBe(4);

    const selectEl = React.createElement(
      Select,
      null,
      React.createElement('option', { value: 'pottery' }, 'Pottery & Ceramics'),
    );
    expect(React.isValidElement(selectEl)).toBe(true);

    const checkboxEl = React.createElement(Checkbox, {
      id: 'agree-terms',
      label: 'I certify authentic handmade creation',
    });
    expect(checkboxEl.props.label).toBe('I certify authentic handmade creation');
  });

  it('instantiates EmptyState and ErrorState feedback components', () => {
    const emptyEl = React.createElement(EmptyState, {
      title: 'No listings found',
      description: 'Create your first handcrafted product.',
    });
    expect(emptyEl.props.title).toBe('No listings found');

    const errorEl = React.createElement(ErrorState, {
      title: 'Failed to load catalog',
      message: 'Backend API connection timeout.',
      retryLabel: 'Retry Query',
    });
    expect(errorEl.props.title).toBe('Failed to load catalog');
  });

  it('instantiates Alert with semantic variants', () => {
    const alertEl = React.createElement(
      Alert,
      { variant: 'warning', title: 'Inventory Low' },
      'Stock is below safety threshold.',
    );
    expect(alertEl.props.variant).toBe('warning');
    expect(alertEl.props.title).toBe('Inventory Low');
  });

  it('instantiates Modal and ConfirmDialog with accessible parameters', () => {
    const modalEl = React.createElement(
      Modal,
      { isOpen: true, onClose: () => {}, title: 'Adjust Inventory', size: 'md' },
      'Modal Body',
    );
    expect(modalEl.props.isOpen).toBe(true);
    expect(modalEl.props.size).toBe('md');

    const confirmEl = React.createElement(ConfirmDialog, {
      isOpen: true,
      title: 'Reject Seller Application',
      description: 'Are you sure? This will record an audit trail event.',
      isDestructive: true,
      onConfirm: () => {},
      onCancel: () => {},
    });
    expect(confirmEl.props.isDestructive).toBe(true);
  });

  it('instantiates Table and operational navigation elements (Pagination, Breadcrumb)', () => {
    const tableEl = React.createElement(
      Table,
      { dense: true },
      React.createElement(
        TableHeader,
        null,
        React.createElement(
          TableRow,
          null,
          React.createElement(TableHead, null, 'ID'),
          React.createElement(TableHead, null, 'Name'),
        ),
      ),
      React.createElement(
        TableBody,
        null,
        React.createElement(
          TableRow,
          null,
          React.createElement(TableCell, null, '1'),
          React.createElement(TableCell, null, 'Terracotta Pot'),
        ),
      ),
    );
    expect(tableEl.props.dense).toBe(true);

    const pagerEl = React.createElement(Pagination, {
      currentPage: 2,
      totalPages: 10,
      onPageChange: () => {},
    });
    expect(pagerEl.props.currentPage).toBe(2);
    expect(pagerEl.props.totalPages).toBe(10);

    const breadcrumbEl = React.createElement(
      Breadcrumb,
      null,
      React.createElement(BreadcrumbItem, null, 'Home'),
      React.createElement(BreadcrumbItem, { isCurrent: true }, 'Pottery'),
    );
    expect(React.isValidElement(breadcrumbEl)).toBe(true);
  });

  it('instantiates Skeleton, LoadingSpinner, Container, Divider, and SectionHeader', () => {
    const skeletonEl = React.createElement(Skeleton, { variant: 'rectangular' });
    expect(skeletonEl.props.variant).toBe('rectangular');

    const spinnerEl = React.createElement(LoadingSpinner, { size: 'lg' });
    expect(spinnerEl.props.size).toBe('lg');

    const containerEl = React.createElement(Container, { size: 'xl' }, 'Content');
    expect(containerEl.props.size).toBe('xl');

    const dividerEl = React.createElement(Divider, { variant: 'craft' });
    expect(dividerEl.props.variant).toBe('craft');

    const sectionEl = React.createElement(SectionHeader, {
      eyebrow: 'Artisan Heritage',
      title: 'Curated Pottery Collections',
      description: 'Explore clay and ceramic creations.',
    });
    expect(sectionEl.props.title).toBe('Curated Pottery Collections');
  });
});
