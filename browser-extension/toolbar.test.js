import {test, expect} from 'bun:test';
import {Window} from 'happy-dom';

test('panel toolbar is one compact accessible row with an external chat link and icon controls', async () => {
  const window = new Window();
  window.document.write(await Bun.file(new URL('./panel.html', import.meta.url)).text());
  const header = window.document.querySelector('.panel-toolbar');
  expect(header).not.toBeNull();
  const link = header.querySelector('#open');
  expect(link.target).toBe('_blank');
  expect(link.rel).toBe('noopener');
  for (const id of ['retry', 'settings']) {
    const button = header.querySelector('#' + id);
    expect(button.getAttribute('aria-label')).toBeTruthy();
    expect(button.getAttribute('title')).toBeTruthy();
    expect(button.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  }
  expect(header.querySelector('#status').className).toBe('sr-only');
  expect(header.querySelector('#source').className).toBe('sr-only');
  const css = await Bun.file(new URL('./style.css', import.meta.url)).text();
  expect(css).toContain('height: 30px;');
  expect(css).toContain(':focus-visible');
  window.happyDOM.abort();
});
