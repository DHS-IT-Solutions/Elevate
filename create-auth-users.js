const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://mmwsoiswgsajpzzgyick.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1td3NvaXN3Z3NhanB6emd5aWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMwODEzMCwiZXhwIjoyMDg2ODg0MTMwfQ.9NoWE97h1uaI_7fai00SJFND-7ihsHOP71wfsKLrKko' // Service role key, not anon key!
)

const users = [
  // Your existing admin
  { id: '66ae884c-6414-4bb7-890c-c521b632f9bf', email: 'admin@dhsit.co.uk', password: 'Admin@123' },
  
  // Team Leads
  { id: 'user-lead-001', email: 'rajesh.kumar@dhsit.co.uk', password: 'Test@123' },
  { id: 'user-lead-002', email: 'priya.sharma@dhsit.co.uk', password: 'Test@123' },
  { id: 'user-lead-003', email: 'james.wilson@dhsit.co.uk', password: 'Test@123' },
  
  // Engineers
  { id: 'user-eng-001', email: 'arun.patel@dhsit.co.uk', password: 'Test@123' },
  { id: 'user-eng-002', email: 'sneha.reddy@dhsit.co.uk', password: 'Test@123' },
  { id: 'user-eng-003', email: 'vikram.singh@dhsit.co.uk', password: 'Test@123' },
  { id: 'user-eng-004', email: 'divya.nair@dhsit.co.uk', password: 'Test@123' },
  { id: 'user-eng-005', email: 'rohit.verma@dhsit.co.uk', password: 'Test@123' },
  { id: 'user-eng-006', email: 'ananya.menon@dhsit.co.uk', password: 'Test@123' },
  { id: 'user-eng-007', email: 'karthik.iyer@dhsit.co.uk', password: 'Test@123' },
  { id: 'user-eng-008', email: 'meera.krishnan@dhsit.co.uk', password: 'Test@123' },
  
  // HR
  { id: 'user-hr-001', email: 'lakshmi.devi@dhsit.co.uk', password: 'Test@123' },
  { id: 'user-hr-002', email: 'sanjay.gupta@dhsit.co.uk', password: 'Test@123' },
  { id: 'user-hr-003', email: 'neha.joshi@dhsit.co.uk', password: 'Test@123' },
  
  // Sales
  { id: 'user-sales-001', email: 'sarah.thompson@dhsit.co.uk', password: 'Test@123' },
  { id: 'user-sales-002', email: 'michael.brown@dhsit.co.uk', password: 'Test@123' },
  { id: 'user-sales-003', email: 'emily.davis@dhsit.co.uk', password: 'Test@123' },
  
  // Operations
  { id: 'user-ops-001', email: 'arjun.rao@dhsit.co.uk', password: 'Test@123' },
  { id: 'user-ops-002', email: 'pooja.desai@dhsit.co.uk', password: 'Test@123' },
]

async function createUsers() {
  for (const user of users) {
    console.log(`Creating user: ${user.email}`)
    
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true, // Auto-confirm
      user_metadata: {
        first_name: user.email.split('.')[0],
        last_name: user.email.split('.')[1].split('@')[0]
      }
    })
    
    if (error) {
      console.error(`Error creating ${user.email}:`, error.message)
    } else {
      console.log(`✅ Created ${user.email} with ID: ${data.user.id}`)
      
      // IMPORTANT: Update the employee record with the correct auth user ID
      // This is needed because Supabase generates its own UUIDs
      const { error: updateError } = await supabase
        .from('employees')
        .update({ user_id: data.user.id })
        .eq('email', user.email)
      
      if (updateError) {
        console.error(`Error updating employee ${user.email}:`, updateError.message)
      }
    }
  }
  
  console.log('\n✅ All users created!')
}

createUsers()
