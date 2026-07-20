/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it } from 'vitest'

import { CompletionsDemo } from './completions-demo'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
const reactTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean
}

beforeEach(() => {
  reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

it('selects the highlighted ranked completion with the keyboard', async () => {
  await act(async () => {
    root.render(<CompletionsDemo />)
  })
  const section = container.querySelector('[aria-label="Ranked autocomplete example"]')
  const input = section?.querySelector('input')
  if (!(section && input)) {
    throw new Error('ranked autocomplete demo did not mount')
  }

  await act(async () => {
    input.value = '10 kg to 16'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 160))
  })
  expect(
    Array.from(section.querySelectorAll('[role="option"]'), (item) => item.textContent),
  ).toEqual(
    expect.arrayContaining([
      expect.stringContaining('10–16 kg'),
      expect.stringContaining('10–16 lb'),
    ]),
  )

  act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
  expect(input.getAttribute('aria-activedescendant')).toMatch(/item-1$/)

  act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
  expect(input.value).toBe('10–16 lb')
})
