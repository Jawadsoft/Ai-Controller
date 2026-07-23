-- =====================================================
-- CrewAI Agent User Assignment System
-- =====================================================
-- This extends the multi-user system to include CrewAI agent assignments

-- Create CrewAI Agent User Assignments Table
CREATE TABLE IF NOT EXISTS crew_ai_agent_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES dealership_staff(id) ON DELETE CASCADE, -- NULL for unassigned agents
    agent_type VARCHAR(50) NOT NULL, -- 'sales_consultant', 'product_specialist', 'finance_manager', 'service_advisor', 'inventory_specialist'
    agent_name VARCHAR(100) NOT NULL,
    agent_role TEXT NOT NULL,
    agent_capabilities TEXT[] DEFAULT '{}',
    agent_priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    auto_assignment BOOLEAN DEFAULT false, -- Whether this agent can be auto-assigned
    max_concurrent_conversations INTEGER DEFAULT 5,
    current_conversations INTEGER DEFAULT 0,
    performance_score DECIMAL(3,2) DEFAULT 0.00, -- 0.00 to 1.00
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one agent type per dealer
    UNIQUE(dealer_id, agent_type)
);

-- Create CrewAI Agent Performance Tracking Table
CREATE TABLE IF NOT EXISTS crew_ai_agent_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    assignment_id UUID NOT NULL REFERENCES crew_ai_agent_assignments(id) ON DELETE CASCADE,
    conversation_id UUID,
    customer_satisfaction INTEGER CHECK (customer_satisfaction >= 1 AND customer_satisfaction <= 5),
    response_time_ms INTEGER,
    success_rate BOOLEAN,
    handoff_needed BOOLEAN DEFAULT false,
    resolution_time_ms INTEGER,
    customer_feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create CrewAI Agent Availability Table
CREATE TABLE IF NOT EXISTS crew_ai_agent_availability (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    assignment_id UUID NOT NULL REFERENCES crew_ai_agent_assignments(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
    start_time TIME,
    end_time TIME,
    is_available BOOLEAN DEFAULT true,
    max_conversations INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(assignment_id, day_of_week)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_crew_ai_agent_assignments_dealer_id ON crew_ai_agent_assignments(dealer_id);
CREATE INDEX IF NOT EXISTS idx_crew_ai_agent_assignments_staff_id ON crew_ai_agent_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_crew_ai_agent_assignments_agent_type ON crew_ai_agent_assignments(agent_type);
CREATE INDEX IF NOT EXISTS idx_crew_ai_agent_assignments_active ON crew_ai_agent_assignments(is_active);
CREATE INDEX IF NOT EXISTS idx_crew_ai_agent_performance_assignment_id ON crew_ai_agent_performance(assignment_id);
CREATE INDEX IF NOT EXISTS idx_crew_ai_agent_performance_created_at ON crew_ai_agent_performance(created_at);
CREATE INDEX IF NOT EXISTS idx_crew_ai_agent_availability_assignment_id ON crew_ai_agent_availability(assignment_id);

-- Create triggers for updated_at
CREATE TRIGGER update_crew_ai_agent_assignments_updated_at 
    BEFORE UPDATE ON crew_ai_agent_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crew_ai_agent_availability_updated_at 
    BEFORE UPDATE ON crew_ai_agent_availability
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to get available agents for a dealer
CREATE OR REPLACE FUNCTION get_available_agents_for_dealer(dealer_uuid UUID)
RETURNS TABLE(
    assignment_id UUID,
    agent_type VARCHAR(50),
    agent_name VARCHAR(100),
    staff_name TEXT,
    staff_email TEXT,
    current_conversations INTEGER,
    max_concurrent_conversations INTEGER,
    performance_score DECIMAL(3,2),
    is_available BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        caa.id as assignment_id,
        caa.agent_type,
        caa.agent_name,
        COALESCE(u.name, 'Unassigned') as staff_name,
        COALESCE(u.email, 'N/A') as staff_email,
        caa.current_conversations,
        caa.max_concurrent_conversations,
        caa.performance_score,
        CASE 
            WHEN caa.current_conversations < caa.max_concurrent_conversations 
            AND caa.is_active = true 
            THEN true 
            ELSE false 
        END as is_available
    FROM crew_ai_agent_assignments caa
    LEFT JOIN dealership_staff ds ON caa.staff_id = ds.id
    LEFT JOIN users u ON ds.user_id = u.id
    WHERE caa.dealer_id = dealer_uuid
    ORDER BY caa.agent_priority, caa.performance_score DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to assign agent to staff member
CREATE OR REPLACE FUNCTION assign_agent_to_staff(
    dealer_uuid UUID,
    agent_type_param VARCHAR(50),
    staff_uuid UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    assignment_exists BOOLEAN;
BEGIN
    -- Check if assignment already exists
    SELECT EXISTS(
        SELECT 1 FROM crew_ai_agent_assignments 
        WHERE dealer_id = dealer_uuid AND agent_type = agent_type_param
    ) INTO assignment_exists;
    
    IF assignment_exists THEN
        -- Update existing assignment
        UPDATE crew_ai_agent_assignments 
        SET staff_id = staff_uuid, updated_at = NOW()
        WHERE dealer_id = dealer_uuid AND agent_type = agent_type_param;
    ELSE
        -- Create new assignment
        INSERT INTO crew_ai_agent_assignments (
            dealer_id, staff_id, agent_type, agent_name, agent_role, agent_capabilities
        ) VALUES (
            dealer_uuid, 
            staff_uuid, 
            agent_type_param,
            CASE agent_type_param
                WHEN 'sales_consultant' THEN 'Sales Consultant'
                WHEN 'product_specialist' THEN 'Product Specialist'
                WHEN 'finance_manager' THEN 'Finance Manager'
                WHEN 'service_advisor' THEN 'Service Advisor'
                WHEN 'inventory_specialist' THEN 'Inventory Specialist'
                ELSE 'Custom Agent'
            END,
            CASE agent_type_param
                WHEN 'sales_consultant' THEN 'Handles vehicle sales, customer guidance, and closing deals'
                WHEN 'product_specialist' THEN 'Provides detailed vehicle information, specifications, and comparisons'
                WHEN 'finance_manager' THEN 'Manages financing options, loans, and payment calculations'
                WHEN 'service_advisor' THEN 'Handles service appointments, maintenance, and warranty questions'
                WHEN 'inventory_specialist' THEN 'Manages inventory search and vehicle availability'
                ELSE 'Custom agent role'
            END,
            CASE agent_type_param
                WHEN 'sales_consultant' THEN ARRAY['sales', 'customer_guidance', 'closing', 'negotiation']
                WHEN 'product_specialist' THEN ARRAY['vehicle_specs', 'comparisons', 'features', 'test_drives']
                WHEN 'finance_manager' THEN ARRAY['financing', 'loans', 'payments', 'insurance']
                WHEN 'service_advisor' THEN ARRAY['service', 'maintenance', 'warranty', 'appointments']
                WHEN 'inventory_specialist' THEN ARRAY['inventory', 'availability', 'search', 'matching']
                ELSE ARRAY['general']
            END
        );
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Create function to unassign agent from staff
CREATE OR REPLACE FUNCTION unassign_agent_from_staff(
    dealer_uuid UUID,
    agent_type_param VARCHAR(50)
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE crew_ai_agent_assignments 
    SET staff_id = NULL, updated_at = NOW()
    WHERE dealer_id = dealer_uuid AND agent_type = agent_type_param;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Create function to get agent performance summary
CREATE OR REPLACE FUNCTION get_agent_performance_summary(
    dealer_uuid UUID,
    days_back INTEGER DEFAULT 30
)
RETURNS TABLE(
    assignment_id UUID,
    agent_type VARCHAR(50),
    agent_name VARCHAR(100),
    staff_name TEXT,
    total_conversations BIGINT,
    avg_satisfaction DECIMAL(3,2),
    avg_response_time DECIMAL(10,2),
    success_rate DECIMAL(5,2),
    handoff_rate DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        caa.id as assignment_id,
        caa.agent_type,
        caa.agent_name,
        COALESCE(u.name, 'Unassigned') as staff_name,
        COUNT(cap.id) as total_conversations,
        ROUND(AVG(cap.customer_satisfaction), 2) as avg_satisfaction,
        ROUND(AVG(cap.response_time_ms), 2) as avg_response_time,
        ROUND(
            (COUNT(CASE WHEN cap.success_rate = true THEN 1 END)::DECIMAL / 
             NULLIF(COUNT(cap.id), 0)) * 100, 2
        ) as success_rate,
        ROUND(
            (COUNT(CASE WHEN cap.handoff_needed = true THEN 1 END)::DECIMAL / 
             NULLIF(COUNT(cap.id), 0)) * 100, 2
        ) as handoff_rate
    FROM crew_ai_agent_assignments caa
    LEFT JOIN dealership_staff ds ON caa.staff_id = ds.id
    LEFT JOIN users u ON ds.user_id = u.id
    LEFT JOIN crew_ai_agent_performance cap ON caa.id = cap.assignment_id
        AND cap.created_at >= NOW() - INTERVAL '1 day' * days_back
    WHERE caa.dealer_id = dealer_uuid
    GROUP BY caa.id, caa.agent_type, caa.agent_name, u.name
    ORDER BY caa.agent_priority;
END;
$$ LANGUAGE plpgsql;

-- Insert default agent assignments for existing dealers
INSERT INTO crew_ai_agent_assignments (
    dealer_id, 
    agent_type, 
    agent_name, 
    agent_role, 
    agent_capabilities,
    agent_priority
)
SELECT 
    d.id as dealer_id,
    agent_type,
    agent_name,
    agent_role,
    agent_capabilities,
    agent_priority
FROM dealers d
CROSS JOIN (
    VALUES 
        ('sales_consultant', 'Sales Consultant', 'Handles vehicle sales, customer guidance, and closing deals', ARRAY['sales', 'customer_guidance', 'closing', 'negotiation'], 1),
        ('product_specialist', 'Product Specialist', 'Provides detailed vehicle information, specifications, and comparisons', ARRAY['vehicle_specs', 'comparisons', 'features', 'test_drives'], 2),
        ('finance_manager', 'Finance Manager', 'Manages financing options, loans, and payment calculations', ARRAY['financing', 'loans', 'payments', 'insurance'], 3),
        ('service_advisor', 'Service Advisor', 'Handles service appointments, maintenance, and warranty questions', ARRAY['service', 'maintenance', 'warranty', 'appointments'], 4),
        ('inventory_specialist', 'Inventory Specialist', 'Manages inventory search and vehicle availability', ARRAY['inventory', 'availability', 'search', 'matching'], 5)
) AS default_agents(agent_type, agent_name, agent_role, agent_capabilities, agent_priority)
WHERE NOT EXISTS (
    SELECT 1 FROM crew_ai_agent_assignments caa 
    WHERE caa.dealer_id = d.id AND caa.agent_type = default_agents.agent_type
);

-- Add comments for documentation
COMMENT ON TABLE crew_ai_agent_assignments IS 'Assigns CrewAI agents to staff members for each dealership';
COMMENT ON TABLE crew_ai_agent_performance IS 'Tracks performance metrics for CrewAI agent assignments';
COMMENT ON TABLE crew_ai_agent_availability IS 'Defines availability schedules for CrewAI agents';
COMMENT ON FUNCTION get_available_agents_for_dealer IS 'Returns all available agents for a specific dealer';
COMMENT ON FUNCTION assign_agent_to_staff IS 'Assigns a CrewAI agent to a staff member';
COMMENT ON FUNCTION unassign_agent_from_staff IS 'Unassigns a CrewAI agent from staff';
COMMENT ON FUNCTION get_agent_performance_summary IS 'Returns performance summary for all agents of a dealer';

-- Migration completed
SELECT 'CrewAI Agent User Assignment system migration completed successfully' as status;
