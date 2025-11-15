import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import App from '../App.jsx'
import { RouterProvider } from '../router.jsx'

describe('Requests sub-tabs', () => {
  beforeEach(() => localStorage.clear())

  it('renders Time Off and Swaps tabs with counters', async () => {
    // Seed as manager user
    localStorage.setItem('shiftmate_v2', JSON.stringify({
      locations:[{id:'loc1', name:'Main Shop'}],
      positions:[{id:'p1', location_id:'loc1', name:'Role'}],
      users:[
        {id:'m1', location_id:'loc1', full_name:'Manager', email:'manager@demo.local', password:'demo', role:'manager', is_active:true}
      ],
      schedules:[], time_off_requests:[], unavailability:[]
    }))
    localStorage.setItem('shiftmate_current_user', 'm1')
    render(
      <RouterProvider>
        <App />
      </RouterProvider>
    )

    const requestsTab = await screen.findByRole('button', { name: /requests/i })
    fireEvent.click(requestsTab)

    expect(await screen.findByRole('button', { name: /time off \(/i })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /swaps \(/i })).toBeInTheDocument()
  })
})
