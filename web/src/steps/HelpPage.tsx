type Props = {
  onBack: () => void;
};

const sectionStyle: React.CSSProperties = {
  marginBottom: '1.75rem',
};
const headingStyle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  color: '#e2e8f0',
  marginBottom: '0.5rem',
};
const bodyStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#94a3b8',
  lineHeight: 1.55,
  margin: 0,
};
const listStyle: React.CSSProperties = {
  ...bodyStyle,
  marginTop: '0.5rem',
  paddingLeft: '1.25rem',
};
const backButtonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  background: 'transparent',
  border: '1px solid #475569',
  borderRadius: '6px',
  color: '#e2e8f0',
  fontSize: '0.875rem',
  cursor: 'pointer',
  marginBottom: '1.5rem',
};

export function HelpPage({ onBack }: Props) {
  return (
    <section style={{ maxWidth: '32rem', margin: '0 auto', paddingBottom: '2rem' }}>
      <button type="button" onClick={onBack} style={backButtonStyle}>
        ← Back
      </button>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: '#e2e8f0' }}>
        How Cloud Builder works
      </h1>
      <p style={bodyStyle}>
        A short guide to the app and what each part does. Use this page anytime you need a reminder.
      </p>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>What is Cloud Builder?</h2>
        <p style={bodyStyle}>
          Cloud Builder is an Azure infrastructure wizard. You define a project (name, resource group, region), a virtual network with subnets, and which Azure services you want (e.g. VMs, VMSS). Then you download ready-to-deploy <strong style={{ color: '#cbd5e1' }}>Bicep</strong> or <strong style={{ color: '#cbd5e1' }}>Terraform</strong> code. Nothing is deployed from this app—you get a ZIP to use in your own pipelines or with Azure CLI / Terraform CLI.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Sign in and accounts</h2>
        <p style={bodyStyle}>
          Sign in to save your generations and see them in <strong style={{ color: '#cbd5e1' }}>My generations</strong>. You can download any past design again in Bicep or Terraform, or delete it from your list. Your data is stored securely and linked to your account.
        </p>
        <ul style={listStyle}>
          <li><strong>Register</strong> — Create an account (email + password) to start saving.</li>
          <li><strong>Forgot password</strong> — We send a secure link by email (valid 1 hour) to set a new password. Check spam if you don’t see it. We never reveal whether an account exists.</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>My generations</h2>
        <p style={bodyStyle}>
          This list shows every architecture you generated while signed in. For each one you can:
        </p>
        <ul style={listStyle}>
          <li><strong>Download Bicep</strong> — Get a ZIP with <code style={{ background: '#334155', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.8125rem' }}>main.bicep</code> and modules. Deploy with Azure CLI or Bicep deployment stacks.</li>
          <li><strong>Download Terraform</strong> — Get a ZIP with <code style={{ background: '#334155', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.8125rem' }}>.tf</code> files. Run <code style={{ background: '#334155', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.8125rem' }}>terraform init</code> and <code style={{ background: '#334155', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.8125rem' }}>terraform apply</code> in the folder.</li>
          <li><strong>Delete</strong> — Removes the entry from your list only. It does not delete any resources in Azure.</li>
        </ul>
        <p style={bodyStyle}>
          The badge next to each item (Valid, Warnings, Invalid, or Not validated) shows whether the generated code passed <code style={{ background: '#334155', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.8125rem' }}>bicep build</code> or <code style={{ background: '#334155', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.8125rem' }}>terraform validate</code> when you generated it. If the server didn’t have the CLI installed, you’ll see “Not validated”—the code is still generated and usable.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Generate new</h2>
        <p style={bodyStyle}>
          Starts the wizard with four steps:
        </p>
        <ul style={listStyle}>
          <li><strong>Project</strong> — Project name (lowercase, hyphens OK), resource group name (optional; defaults to <code style={{ background: '#334155', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.8125rem' }}>project-rg</code>), and Azure region.</li>
          <li><strong>Network</strong> — Virtual network (VNet) and subnets. Use the default layout for a ready-made setup, or customize names and CIDR ranges. Services you add later are placed into one of these subnets.</li>
          <li><strong>Services</strong> — Pick Azure resources (e.g. VM, VMSS). Give each a name and choose which subnet it goes in. The generated Bicep or Terraform will create these resources in Azure.</li>
          <li><strong>Summary</strong> — Review and choose output format. You can download Bicep, Terraform, or both for the same design.</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Bicep vs Terraform</h2>
        <p style={bodyStyle}>
          Same design, different formats. <strong style={{ color: '#cbd5e1' }}>Bicep</strong> is Azure’s native language; use it with Azure CLI or deployment stacks. <strong style={{ color: '#cbd5e1' }}>Terraform</strong> uses the Azure provider and fits into Terraform workflows and state. Choose the one that matches your pipeline—you can always download the other format later from My generations.
        </p>
      </div>
    </section>
  );
}
