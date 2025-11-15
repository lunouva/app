import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import App from '../App.jsx'

describe('Schedule toggle persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows only My Schedule for employees', async () => {
    // Seed localStorage so App loads authenticated as an employee
    localStorage.setItem('shiftmate_v2', JSON.stringify({
      locations:[{id:'loc1', name:'Main Shop'}],
      positions:[{id:'p1', location_id:'loc1', name:'Role'}],
      users:[
        {id:'u1', location_id:'loc1', full_name:'Lily', email:'lily@example.com', password:'demo', role:'employee', is_active:true}
      ],
      schedules:[], time_off_requests:[], unavailability:[]
    }))
    localStorage.setItem('shiftmate_current_user', 'u1')
    render(<App />)

    // Nav shows Schedule
    const myBtn = await screen.findByRole('button', { name: /my schedule/i })

    // Expect My to be active and Full not visible for employees
    expect(myBtn.className).toMatch(/bg-black/)
    expect(screen.queryByRole('button', { name: /full schedule/i })).toBeNull()
  })
})
