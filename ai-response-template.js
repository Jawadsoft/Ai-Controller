// AI Response Template with List-Based Options
// This template provides structured responses for the D.A.I.V.E. AI Bot

const responseTemplates = {
  // Test Drive Scheduling Response
  testDriveOptions: {
    title: "🚗 Test Drive Scheduling Options",
    message: "Great! Here are your test drive options:",
    options: [
      {
        number: "1",
        title: "Choose Your Vehicle",
        description: "Select from our available inventory",
        details: "We have SUVs, Sedans, Trucks, and more"
      },
      {
        number: "2", 
        title: "Select Time & Date",
        description: "Pick from available slots",
        details: "Monday-Saturday, 9 AM - 6 PM"
      },
      {
        number: "3",
        title: "Required Documents",
        description: "What you need to bring",
        details: "Driver's license and proof of insurance"
      }
    ],
    footer: "Which option would you like to start with?"
  },

  // Vehicle Selection Response
  vehicleSelection: {
    title: "🚙 Available Vehicle Options",
    message: "Here are our current vehicles:",
    options: [
      {
        number: "1",
        title: "SUV Category",
        description: "Family-friendly options",
        details: "Honda CR-V, Toyota RAV4, Ford Explorer"
      },
      {
        number: "2",
        title: "Sedan Category", 
        description: "Efficient daily drivers",
        details: "Honda Accord, Toyota Camry, Ford Fusion"
      },
      {
        number: "3",
        title: "Truck Category",
        description: "Work and utility vehicles",
        details: "Ford F-150, Chevrolet Silverado, Ram 1500"
      }
    ],
    footer: "Which vehicle type interests you?"
  },

  // Service Options Response
  serviceOptions: {
    title: "🔧 Service & Maintenance Options",
    message: "Here are our service offerings:",
    options: [
      {
        number: "1",
        title: "Oil Change Service",
        description: "Regular maintenance",
        details: "Synthetic oil, filter replacement, inspection"
      },
      {
        number: "2",
        title: "Brake Service",
        description: "Safety maintenance",
        details: "Pad replacement, rotor inspection, fluid check"
      },
      {
        number: "3",
        title: "Tire Service",
        description: "Tire maintenance",
        details: "Rotation, balancing, alignment, replacement"
      }
    ],
    footer: "What service do you need today?"
  },

  // Financing Options Response
  financingOptions: {
    title: "💰 Financing & Payment Options",
    message: "Here are your financing choices:",
    options: [
      {
        number: "1",
        title: "Traditional Auto Loan",
        description: "Standard financing",
        details: "Competitive rates, flexible terms"
      },
      {
        number: "2",
        title: "Lease Options",
        description: "Lower monthly payments",
        details: "New vehicle every few years"
      },
      {
        number: "3",
        title: "Cash Purchase",
        description: "Full payment",
        details: "No interest, immediate ownership"
      }
    ],
    footer: "Which financing option works best for you?"
  }
};

// Function to format response with HTML list
function formatListResponse(template) {
  let response = `**${template.title}**\n\n`;
  response += `${template.message}\n\n`;
  
  template.options.forEach(option => {
    response += `**${option.number}. ${option.title}**\n`;
    response += `   • ${option.description}\n`;
    response += `   • ${option.details}\n\n`;
  });
  
  response += `**${template.footer}**`;
  
  return response;
}

// Function to format response with numbered list (plain text)
function formatNumberedResponse(template) {
  let response = `${template.title}\n\n`;
  response += `${template.message}\n\n`;
  
  template.options.forEach(option => {
    response += `${option.number}. ${option.title}\n`;
    response += `   - ${option.description}\n`;
    response += `   - ${option.details}\n\n`;
  });
  
  response += `${template.footer}`;
  
  return response;
}

// Function to format response with bullet points
function formatBulletResponse(template) {
  let response = `${template.title}\n\n`;
  response += `${template.message}\n\n`;
  
  template.options.forEach(option => {
    response += `• **${option.title}**\n`;
    response += `  ${option.description}\n`;
    response += `  ${option.details}\n\n`;
  });
  
  response += `${template.footer}`;
  
  return response;
}

// Example usage:
console.log("=== HTML List Format ===");
console.log(formatListResponse(responseTemplates.testDriveOptions));

console.log("\n=== Numbered List Format ===");
console.log(formatNumberedResponse(responseTemplates.vehicleSelection));

console.log("\n=== Bullet Point Format ===");
console.log(formatBulletResponse(responseTemplates.serviceOptions));

// Export for use in other files
export {
  responseTemplates,
  formatListResponse,
  formatNumberedResponse,
  formatBulletResponse
};
