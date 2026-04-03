import { useState, useEffect } from 'react'
import { Sun, Moon, Languages, Terminal, Copy, Check } from 'lucide-react'

const translations = {
  en: {
    title: 'OSPF Config Generator',
    subtitle: 'Generate OSPF configuration for Cisco, Juniper, Huawei and MikroTik routers.',
    vendor: 'Vendor',
    processId: 'Process ID',
    routerId: 'Router ID',
    area: 'Area',
    networkAddr: 'Network Address',
    wildcard: 'Wildcard Mask',
    areaId: 'Area ID',
    addNetwork: 'Add Network',
    removeNetwork: 'Remove',
    passiveInterfaces: 'Passive Interfaces (comma separated)',
    redistConnected: 'Redistribute Connected',
    redistStatic: 'Redistribute Static',
    redistBgp: 'Redistribute BGP',
    bgpAsn: 'BGP AS Number',
    authentication: 'Authentication',
    authType: 'Auth Type',
    authKey: 'Auth Key/Password',
    helloInterval: 'Hello Interval (s)',
    deadInterval: 'Dead Interval (s)',
    stubArea: 'Stub Area ID (optional)',
    nssaArea: 'NSSA Area ID (optional)',
    generate: 'Generate Config',
    copy: 'Copy',
    copied: 'Copied!',
    output: 'Generated Configuration',
    references: 'References',
    refList: ['RFC 2328 - OSPF Version 2'],
    builtBy: 'Built by',
    authNone: 'None',
    authPlain: 'Plain Text',
    authMd5: 'MD5',
    noConfig: 'Fill in the options above and click "Generate Config".',
  },
  pt: {
    title: 'Gerador de Config OSPF',
    subtitle: 'Gere configuracao OSPF para roteadores Cisco, Juniper, Huawei e MikroTik.',
    vendor: 'Fabricante',
    processId: 'ID do Processo',
    routerId: 'Router ID',
    area: 'Area',
    networkAddr: 'Endereco de Rede',
    wildcard: 'Mascara Wildcard',
    areaId: 'ID da Area',
    addNetwork: 'Adicionar Rede',
    removeNetwork: 'Remover',
    passiveInterfaces: 'Interfaces Passivas (separadas por virgula)',
    redistConnected: 'Redistribuir Conectadas',
    redistStatic: 'Redistribuir Estaticas',
    redistBgp: 'Redistribuir BGP',
    bgpAsn: 'ASN do BGP',
    authentication: 'Autenticacao',
    authType: 'Tipo de Auth',
    authKey: 'Chave/Senha Auth',
    helloInterval: 'Intervalo Hello (s)',
    deadInterval: 'Intervalo Dead (s)',
    stubArea: 'ID da Area Stub (opcional)',
    nssaArea: 'ID da Area NSSA (opcional)',
    generate: 'Gerar Configuracao',
    copy: 'Copiar',
    copied: 'Copiado!',
    output: 'Configuracao Gerada',
    references: 'Referencias',
    refList: ['RFC 2328 - OSPF Versao 2'],
    builtBy: 'Criado por',
    authNone: 'Nenhuma',
    authPlain: 'Texto Simples',
    authMd5: 'MD5',
    noConfig: 'Preencha as opcoes acima e clique em "Gerar Configuracao".',
  },
} as const

type Lang = keyof typeof translations
type Vendor = 'cisco' | 'juniper' | 'huawei' | 'mikrotik'
type AuthType = 'none' | 'plain' | 'md5'

interface Network {
  id: string
  address: string
  wildcard: string
  area: string
}

let uid = 0

function generateCisco(cfg: Config): string {
  const lines: string[] = []
  lines.push(`router ospf ${cfg.processId}`)
  if (cfg.routerId) lines.push(` router-id ${cfg.routerId}`)
  for (const net of cfg.networks) {
    lines.push(` network ${net.address} ${net.wildcard} area ${net.area}`)
  }
  if (cfg.passiveInterfaces) {
    for (const iface of cfg.passiveInterfaces.split(',').map(s => s.trim()).filter(Boolean)) {
      lines.push(` passive-interface ${iface}`)
    }
  }
  if (cfg.redistConnected) lines.push(' redistribute connected subnets')
  if (cfg.redistStatic) lines.push(' redistribute static subnets')
  if (cfg.redistBgp) lines.push(` redistribute bgp ${cfg.bgpAsn} subnets`)
  if (cfg.stubArea) lines.push(` area ${cfg.stubArea} stub`)
  if (cfg.nssaArea) lines.push(` area ${cfg.nssaArea} nssa`)
  if (cfg.helloInterval !== 10) lines.push(` timers hello ${cfg.helloInterval}`)
  if (cfg.authType !== 'none') {
    lines.push(` area 0 authentication${cfg.authType === 'md5' ? ' message-digest' : ''}`)
    lines.push(`!`)
    lines.push(`interface <interface-name>`)
    if (cfg.authType === 'md5') lines.push(` ip ospf message-digest-key 1 md5 ${cfg.authKey}`)
    else lines.push(` ip ospf authentication-key ${cfg.authKey}`)
    lines.push(` ip ospf hello-interval ${cfg.helloInterval}`)
    lines.push(` ip ospf dead-interval ${cfg.deadInterval}`)
  }
  lines.push('!')
  return lines.join('\n')
}

function generateJuniper(cfg: Config): string {
  const lines: string[] = []
  lines.push('protocols {')
  lines.push('    ospf {')
  if (cfg.routerId) lines.push(`        router-id ${cfg.routerId};`)
  const areaMap = new Map<string, Network[]>()
  for (const net of cfg.networks) {
    if (!areaMap.has(net.area)) areaMap.set(net.area, [])
    areaMap.get(net.area)!.push(net)
  }
  for (const [areaId, nets] of areaMap) {
    lines.push(`        area ${areaId} {`)
    if (cfg.stubArea === areaId) lines.push('            stub;')
    if (cfg.nssaArea === areaId) lines.push('            nssa;')
    for (const net of nets) {
      const prefix = net.address + '/' + wildcardToCidr(net.wildcard)
      lines.push(`            interface ${prefix} {`)
      if (cfg.helloInterval !== 10) lines.push(`                hello-interval ${cfg.helloInterval};`)
      if (cfg.deadInterval !== 40) lines.push(`                dead-interval ${cfg.deadInterval};`)
      if (cfg.authType === 'md5') lines.push(`                authentication { md5 1 key "${cfg.authKey}"; }`)
      if (cfg.authType === 'plain') lines.push(`                authentication { simple-password "${cfg.authKey}"; }`)
      lines.push('            }')
    }
    if (cfg.passiveInterfaces) {
      for (const iface of cfg.passiveInterfaces.split(',').map(s => s.trim()).filter(Boolean)) {
        lines.push(`            interface ${iface} { passive; }`)
      }
    }
    lines.push('        }')
  }
  if (cfg.redistConnected || cfg.redistStatic || cfg.redistBgp) {
    lines.push('        export [ ')
    if (cfg.redistConnected) lines.push('            EXPORT-CONNECTED')
    if (cfg.redistStatic) lines.push('            EXPORT-STATIC')
    if (cfg.redistBgp) lines.push('            EXPORT-BGP')
    lines.push('        ];')
  }
  lines.push('    }')
  lines.push('}')
  return lines.join('\n')
}

function generateHuawei(cfg: Config): string {
  const lines: string[] = []
  lines.push(`ospf ${cfg.processId} router-id ${cfg.routerId || '1.1.1.1'}`)
  for (const net of cfg.networks) {
    lines.push(` area ${net.area}`)
    lines.push(`  network ${net.address} ${wildcardToMask(net.wildcard)}`)
  }
  if (cfg.stubArea) lines.push(` area ${cfg.stubArea}\n  stub`)
  if (cfg.nssaArea) lines.push(` area ${cfg.nssaArea}\n  nssa`)
  if (cfg.redistConnected) lines.push(' import-route direct')
  if (cfg.redistStatic) lines.push(' import-route static')
  if (cfg.redistBgp) lines.push(` import-route bgp ${cfg.bgpAsn}`)
  if (cfg.passiveInterfaces) {
    for (const iface of cfg.passiveInterfaces.split(',').map(s => s.trim()).filter(Boolean)) {
      lines.push(` silent-interface ${iface}`)
    }
  }
  lines.push('#')
  if (cfg.authType !== 'none') {
    lines.push(`interface <interface-name>`)
    if (cfg.authType === 'md5') lines.push(` ospf authentication-mode md5 1 cipher ${cfg.authKey}`)
    else lines.push(` ospf authentication-mode simple cipher ${cfg.authKey}`)
    lines.push(` ospf timer hello ${cfg.helloInterval}`)
    lines.push(` ospf timer dead ${cfg.deadInterval}`)
    lines.push('#')
  }
  return lines.join('\n')
}

function generateMikroTik(cfg: Config): string {
  const lines: string[] = []
  lines.push(`/routing ospf instance`)
  lines.push(`add name=ospf1 router-id=${cfg.routerId || '1.1.1.1'} version=2`)
  lines.push('')
  lines.push(`/routing ospf area`)
  const areas = [...new Set(cfg.networks.map(n => n.area))]
  for (const areaId of areas) {
    let type = 'default'
    if (cfg.stubArea === areaId) type = 'stub'
    if (cfg.nssaArea === areaId) type = 'nssa'
    lines.push(`add name=area-${areaId} area-id=${areaId} instance=ospf1 type=${type}`)
  }
  lines.push('')
  lines.push(`/routing ospf interface-template`)
  for (const net of cfg.networks) {
    const auth = cfg.authType === 'md5' ? ` auth=md5 auth-key="${cfg.authKey}"` : cfg.authType === 'plain' ? ` auth=simple auth-key="${cfg.authKey}"` : ''
    lines.push(`add networks=${net.address}/${wildcardToCidr(net.wildcard)} area=area-${net.area} hello-interval=${cfg.helloInterval}s dead-interval=${cfg.deadInterval}s${auth}`)
  }
  if (cfg.redistConnected) lines.push(`\n/routing ospf instance set ospf1 redistribute=connected`)
  if (cfg.redistStatic) lines.push(`/routing ospf instance set ospf1 redistribute-static=yes`)
  return lines.join('\n')
}

function wildcardToCidr(wildcard: string): number {
  const parts = wildcard.split('.').map(Number)
  const mask = parts.map(p => (255 - p).toString(2).padStart(8, '0')).join('')
  return mask.split('1').length - 1
}

function wildcardToMask(wildcard: string): string {
  return wildcard.split('.').map(p => (255 - Number(p)).toString()).join('.')
}

interface Config {
  processId: string
  routerId: string
  networks: Network[]
  passiveInterfaces: string
  redistConnected: boolean
  redistStatic: boolean
  redistBgp: boolean
  bgpAsn: string
  authType: AuthType
  authKey: string
  helloInterval: number
  deadInterval: number
  stubArea: string
  nssaArea: string
}

export default function OspfConfigGenerator() {
  const [lang, setLang] = useState<Lang>(() => (navigator.language.startsWith('pt') ? 'pt' : 'en'))
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [vendor, setVendor] = useState<Vendor>('cisco')
  const [processId, setProcessId] = useState('1')
  const [routerId, setRouterId] = useState('1.1.1.1')
  const [networks, setNetworks] = useState<Network[]>([
    { id: 'n0', address: '192.168.0.0', wildcard: '0.0.0.255', area: '0' },
  ])
  const [newAddress, setNewAddress] = useState('')
  const [newWildcard, setNewWildcard] = useState('0.0.0.0')
  const [newArea, setNewArea] = useState('0')
  const [passiveInterfaces, setPassiveInterfaces] = useState('')
  const [redistConnected, setRedistConnected] = useState(false)
  const [redistStatic, setRedistStatic] = useState(false)
  const [redistBgp, setRedistBgp] = useState(false)
  const [bgpAsn, setBgpAsn] = useState('65000')
  const [authType, setAuthType] = useState<AuthType>('none')
  const [authKey, setAuthKey] = useState('')
  const [helloInterval, setHelloInterval] = useState(10)
  const [deadInterval, setDeadInterval] = useState(40)
  const [stubArea, setStubArea] = useState('')
  const [nssaArea, setNssaArea] = useState('')
  const [config, setConfig] = useState('')
  const [copied, setCopied] = useState(false)

  const t = translations[lang]
  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])

  const addNetwork = () => {
    if (!newAddress.trim()) return
    setNetworks(prev => [...prev, { id: `n${uid++}`, address: newAddress.trim(), wildcard: newWildcard, area: newArea }])
    setNewAddress('')
  }

  const removeNetwork = (id: string) => setNetworks(prev => prev.filter(n => n.id !== id))

  const cfg: Config = { processId, routerId, networks, passiveInterfaces, redistConnected, redistStatic, redistBgp, bgpAsn, authType, authKey, helloInterval, deadInterval, stubArea, nssaArea }

  const generate = () => {
    let result = ''
    if (vendor === 'cisco') result = generateCisco(cfg)
    else if (vendor === 'juniper') result = generateJuniper(cfg)
    else if (vendor === 'huawei') result = generateHuawei(cfg)
    else result = generateMikroTik(cfg)
    setConfig(result)
  }

  const handleCopy = () => {
    if (!config) return
    navigator.clipboard.writeText(config).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const inputCls = "w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
  const labelCls = "text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide"

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 transition-colors">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <Terminal size={18} className="text-white" />
            </div>
            <span className="font-semibold">OSPF Config Generator</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLang(l => l === 'en' ? 'pt' : 'en')} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <Languages size={14} />{lang.toUpperCase()}
            </button>
            <button onClick={() => setDark(d => !d)} className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <a href="https://github.com/gmowses/ospf-config-generator" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold">{t.title}</h1>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">{t.subtitle}</p>
          </div>

          {/* Vendor selector */}
          <div className="flex flex-wrap gap-2">
            {(['cisco', 'juniper', 'huawei', 'mikrotik'] as Vendor[]).map(v => (
              <button key={v} onClick={() => setVendor(v)} className={`px-5 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${vendor === v ? 'bg-amber-500 text-white border-amber-500' : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                {v}
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left column: basic config */}
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
                <h2 className="font-semibold">Basic</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>{t.processId}</label><input className={`mt-1 ${inputCls}`} value={processId} onChange={e => setProcessId(e.target.value)} /></div>
                  <div><label className={labelCls}>{t.routerId}</label><input className={`mt-1 ${inputCls}`} value={routerId} onChange={e => setRouterId(e.target.value)} placeholder="1.1.1.1" /></div>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-3">
                <h2 className="font-semibold">{t.area}</h2>
                <div className="flex gap-2 flex-wrap">
                  <input className="flex-1 min-w-[120px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder={t.networkAddr} value={newAddress} onChange={e => setNewAddress(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNetwork()} />
                  <input className="w-28 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder={t.wildcard} value={newWildcard} onChange={e => setNewWildcard(e.target.value)} />
                  <input className="w-16 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder={t.areaId} value={newArea} onChange={e => setNewArea(e.target.value)} />
                  <button onClick={addNetwork} className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 transition-colors">+</button>
                </div>
                <div className="space-y-1.5">
                  {networks.map(net => (
                    <div key={net.id} className="flex items-center gap-2 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 px-3 py-2">
                      <span className="flex-1 text-sm font-mono">{net.address} {net.wildcard}</span>
                      <span className="text-xs text-zinc-400">area {net.area}</span>
                      <button onClick={() => removeNetwork(net.id)} className="text-zinc-400 hover:text-red-500 transition-colors text-xs">&times;</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-3">
                <h2 className="font-semibold">Advanced</h2>
                <div><label className={labelCls}>{t.passiveInterfaces}</label><input className={`mt-1 ${inputCls}`} value={passiveInterfaces} onChange={e => setPassiveInterfaces(e.target.value)} placeholder="Loopback0, GigabitEthernet0/2" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>{t.stubArea}</label><input className={`mt-1 ${inputCls}`} value={stubArea} onChange={e => setStubArea(e.target.value)} placeholder="e.g. 1" /></div>
                  <div><label className={labelCls}>{t.nssaArea}</label><input className={`mt-1 ${inputCls}`} value={nssaArea} onChange={e => setNssaArea(e.target.value)} placeholder="e.g. 2" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>{t.helloInterval}</label><input type="number" className={`mt-1 ${inputCls}`} value={helloInterval} onChange={e => setHelloInterval(Number(e.target.value))} /></div>
                  <div><label className={labelCls}>{t.deadInterval}</label><input type="number" className={`mt-1 ${inputCls}`} value={deadInterval} onChange={e => setDeadInterval(Number(e.target.value))} /></div>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-3">
                <h2 className="font-semibold">{t.authentication}</h2>
                <div>
                  <label className={labelCls}>{t.authType}</label>
                  <select className={`mt-1 ${inputCls}`} value={authType} onChange={e => setAuthType(e.target.value as AuthType)}>
                    <option value="none">{t.authNone}</option>
                    <option value="plain">{t.authPlain}</option>
                    <option value="md5">{t.authMd5}</option>
                  </select>
                </div>
                {authType !== 'none' && <div><label className={labelCls}>{t.authKey}</label><input className={`mt-1 ${inputCls}`} value={authKey} onChange={e => setAuthKey(e.target.value)} placeholder="secret" /></div>}
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-3">
                <h2 className="font-semibold">Redistribution</h2>
                <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={redistConnected} onChange={e => setRedistConnected(e.target.checked)} className="accent-amber-500 h-4 w-4" />{t.redistConnected}</label>
                <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={redistStatic} onChange={e => setRedistStatic(e.target.checked)} className="accent-amber-500 h-4 w-4" />{t.redistStatic}</label>
                <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={redistBgp} onChange={e => setRedistBgp(e.target.checked)} className="accent-amber-500 h-4 w-4" />{t.redistBgp}</label>
                {redistBgp && <div><label className={labelCls}>{t.bgpAsn}</label><input className={`mt-1 ${inputCls}`} value={bgpAsn} onChange={e => setBgpAsn(e.target.value)} /></div>}
              </div>

              <button onClick={generate} className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-3 text-sm font-medium text-white hover:bg-amber-600 transition-colors">
                <Terminal size={16} />{t.generate}
              </button>
            </div>

            {/* Right column: output */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{t.output}</h2>
                {config && (
                  <button onClick={handleCopy} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                    {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                    {copied ? t.copied : t.copy}
                  </button>
                )}
              </div>
              {config ? (
                <pre className="rounded-lg bg-zinc-950 text-zinc-100 p-4 text-xs font-mono whitespace-pre overflow-x-auto leading-relaxed">{config}</pre>
              ) : (
                <div className="rounded-lg border-2 border-dashed border-zinc-200 dark:border-zinc-700 p-8 text-center text-sm text-zinc-400">{t.noConfig}</div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
            <h2 className="font-semibold mb-3">{t.references}</h2>
            <ul className="space-y-1">
              {t.refList.map(ref => (
                <li key={ref} className="text-sm text-zinc-500 dark:text-zinc-400 flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>{ref}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-zinc-400">
          <span>{t.builtBy} <a href="https://github.com/gmowses" className="text-zinc-600 dark:text-zinc-300 hover:text-amber-500 transition-colors">Gabriel Mowses</a></span>
          <span>MIT License</span>
        </div>
      </footer>
    </div>
  )
}
