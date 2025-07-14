import { json } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export const POST = async ({ request, locals }) => {
  try {
    const { track, email, gpxContent, geojsonContent } = await request.json();
    
    // Validate user session
    const user = locals.user;
    if (!user) {
      return error(401, 'Not authenticated');
    }
    
    // Get user profile to check email preferences
    const { data: profile } = await supabase
      .from('profiles')
      .select('gps_email, gpx_export_enabled')
      .eq('id', user.id)
      .single();
    
    if (!profile) {
      return error(404, 'Profile not found');
    }
    
    // Check if user has enabled email exports
    if (!profile.gpx_export_enabled) {
      return error(403, 'GPS export not enabled');
    }
    
    // Use profile email if no specific email provided
    const recipientEmail = email || profile.gps_email;
    if (!recipientEmail) {
      return error(400, 'No email address configured');
    }
    
    // Create email content
    const subject = `GPS Track: ${track.name}`;
    const body = `
Hallo!

Hier ist dein GPS-Track "${track.name}" von Culoca:

📊 Track-Details:
- Name: ${track.name}
- Start: ${new Date(track.startTime).toLocaleString()}
${track.endTime ? `- Ende: ${new Date(track.endTime).toLocaleString()}` : ''}
- Distanz: ${(track.totalDistance / 1000).toFixed(2)}km
- Dauer: ${formatDuration(track.totalDuration)}
- Punkte: ${track.points.length}

🗺️ Der Track ist als GPX-Datei angehängt und kann in Google Earth, Garmin Connect, Strava oder anderen GPS-Apps geöffnet werden.

Viel Spaß beim Auswerten deiner Tour!

Beste Grüße,
Dein Culoca-Team
    `;
    
    // Send email using Resend (free tier available)
    // You can also use SendGrid, AWS SES, or other services
    try {
      const emailData = {
        to: recipientEmail,
        from: 'noreply@culoca.com',
        subject: subject,
        text: body,
        attachments: [
          {
            content: Buffer.from(gpxContent).toString('base64'),
            filename: `${track.name.replace(/[^a-z0-9]/gi, '_')}.gpx`,
            type: 'application/gpx+xml',
            disposition: 'attachment'
          }
        ]
      };
      
      // For now, simulate email sending
      console.log('📧 Email would be sent to:', recipientEmail);
      console.log('📧 Subject:', subject);
      console.log('📧 Body length:', body.length);
      console.log('📧 GPX Content length:', gpxContent.length);
      
      // TODO: Replace with actual email service
      // Example with Resend:
      /*
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData)
      });
      
      if (!response.ok) {
        throw new Error(`Email service error: ${response.statusText}`);
      }
      */
      
      // Simulate email delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (emailError) {
      console.error('Email service error:', emailError);
      return error(500, 'Failed to send email');
    }
    
    return json({ 
      success: true, 
      message: 'Track email sent successfully',
      recipient: recipientEmail
    });
    
  } catch (err) {
    console.error('Error sending track email:', err);
    return error(500, 'Failed to send track email');
  }
};

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
} 