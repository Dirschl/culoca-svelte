<script lang="ts">
  export let profile: any;
  export let isCreator: boolean;
  export let setUserFilter: () => void;
</script>

{#if profile}
  <div class="creator-card">
    <h2 class="creator-title">Ersteller</h2>
    <div class="creator-header">
      {#if profile.avatar_url}
        <img 
          src={profile.avatar_url.startsWith('http') ? profile.avatar_url : `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${profile.avatar_url}`} 
          alt="Avatar" 
          class="avatar clickable-avatar"
          on:click={setUserFilter}
          title={`Nur Bilder von ${profile.full_name} anzeigen`}
        />
      {:else}
        <div 
          class="avatar-placeholder clickable-avatar"
          on:click={setUserFilter}
          title={`Nur Bilder von ${profile.full_name} anzeigen`}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
      {/if}
    </div>
    <div class="creator-details">
      <h3 class="creator-name clickable-name" on:click={setUserFilter} title={`Nur Bilder von ${profile.full_name} anzeigen`}>
        {profile.full_name}
      </h3>
      <div class="creator-address">
        {#if profile.show_address && profile.address}
          <div>{@html profile.address.replace(/\n/g, '<br>')}</div>
        {/if}
      </div>
      <div class="creator-contact">
        {#if profile.show_phone && profile.phone}
          <div>
            <svg class="contact-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
            </svg>
            <a href={`tel:${profile.phone}`}>{profile.phone}</a>
          </div>
        {/if}
        {#if profile.show_email && profile.email}
          <div>
            <svg class="contact-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
            </svg>
            <a href={`mailto:${profile.email}`}>{profile.email}</a>
          </div>
        {/if}
        {#if profile.show_website && profile.website}
          <div>
            <svg class="contact-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
            <a href={profile.website} target="_blank" rel="noopener noreferrer">{profile.website}</a>
          </div>
        {/if}
      </div>
      <div class="creator-socials">
        {#if profile.show_social && profile.instagram}
          <a href={profile.instagram} target="_blank" rel="noopener noreferrer" class="social-link">
            <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </a>
        {/if}
        {#if profile.show_social && profile.facebook}
          <a href={profile.facebook} target="_blank" rel="noopener noreferrer" class="social-link">
            <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </a>
        {/if}
        {#if profile.show_social && profile.twitter}
          <a href={profile.twitter} target="_blank" rel="noopener noreferrer" class="social-link">
            <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
            </svg>
          </a>
        {/if}
      </div>
      {#if profile.show_bio && profile.bio}
        <div class="creator-bio">
          <div>{@html profile.bio.replace(/\n/g, '<br>')}</div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
.column-card h2 {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem;
  padding: 0;
}
.creator-card {
  background: transparent;
  border-radius: 0;
  padding: 0;
  margin: 0;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
}
.creator-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem 0;
  padding: 0;
  text-align: left;
}
.creator-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-bottom: 0.5rem;
}
.avatar, .avatar-placeholder {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-placeholder svg {
  width: 32px;
  height: 32px;
  color: #bbb;
}
.creator-details {
  text-align: left;
  width: 100%;
}
.creator-name {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0.2rem 0 0.5rem 0;
  color: var(--text-primary);
  cursor: pointer;
}
.creator-address {
  font-size: 1rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}
.creator-contact {
  font-size: 1rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  align-items: flex-start;
}
.creator-contact > div {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.contact-icon {
  width: 16px;
  height: 16px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.creator-contact a {
  color: var(--text-secondary);
  text-decoration: none;
}
.creator-contact a:hover {
  color: var(--culoca-orange);
  text-decoration: underline;
}
.creator-bio {
  margin-top: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.9em;
  line-height: 1.4;
  background: transparent;
}
.creator-socials {
  margin-top: 0.5rem;
  display: flex;
  gap: 0.5rem;
  align-items: center;
  background: transparent;
}
.social-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: 4px;
  transition: all 0.2s ease;
  background: transparent;
}
.social-icon {
  width: 20px;
  height: 20px;
  color: var(--text-secondary);
}
.social-link:hover {
  background: var(--bg-tertiary);
  transform: scale(1.1);
}
.social-link:hover .social-icon {
  color: var(--culoca-orange);
}
@media (max-width: 1200px), (max-width: 900px) {
  .creator-details {
    text-align: center;
    align-items: center;
  }
}
</style> 