import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type HistoryEntry = {
	description: string
	cid?: string
}

type History = Record<string, HistoryEntry>

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, '..')
const historyPath = path.join(repositoryRoot, 'src', 'history.json')

const runGit = (args: string[]) => execFileSync('git', args, {
	cwd: repositoryRoot,
	encoding: 'utf8',
}).trim()

const tagExists = (tag: string) => {
	try {
		runGit(['rev-parse', '--verify', `refs/tags/${tag}`])
		return true
	} catch {
		return false
	}
}

const resolveTagName = (tag: string) => {
	if (tagExists(tag)) {
		return tag
	}

	if (tag.startsWith('v') && tagExists(tag.slice(1))) {
		return tag.slice(1)
	}

	if (!tag.startsWith('v') && tagExists(`v${tag}`)) {
		return `v${tag}`
	}

	throw new Error(`Could not find a git tag for history key "${tag}".`)
}

const readTagCid = (tag: string) => {
	const contents = runGit(['for-each-ref', `refs/tags/${tag}`, '--format=%(contents)'])
	const firstLine = contents.split(/\r?\n/, 1)[0].trim()

	if (!firstLine.startsWith('/ipfs/')) {
		throw new Error(`Tag "${tag}" does not start with "/ipfs/<CID>".`)
	}

	return firstLine.slice('/ipfs/'.length).trim()
}

const readCommitChangelog = (fromTag: string) => {
	const output = runGit(['log', '--reverse', '--format=%s', `${fromTag}..HEAD`])

	if (!output) {
		throw new Error(`No commits found between ${fromTag} and HEAD.`)
	}

	return output
		.split(/\r?\n/)
		.filter(Boolean)
		.map((message) => `- ${message}`)
		.join('\n')
}

const nextTag = process.argv[2]

if (!nextTag) {
	throw new Error('Usage: tsx scripts/tag.ts <next-tag>')
}

const rawHistory = readFileSync(historyPath, 'utf8').trim()

if (!rawHistory) {
	throw new Error('src/history.json is empty.')
}

const history = JSON.parse(rawHistory) as History
const historyEntries = Object.entries(history)

if (historyEntries.length === 0) {
	throw new Error('src/history.json does not contain any release entries.')
}

if (Object.prototype.hasOwnProperty.call(history, nextTag)) {
	throw new Error(`History already contains an entry for "${nextTag}".`)
}

const [latestHistoryTag, latestHistoryEntry] = historyEntries[0]
const resolvedLatestTag = resolveTagName(latestHistoryTag)
const latestCid = readTagCid(resolvedLatestTag)
const changelog = readCommitChangelog(resolvedLatestTag)

const updatedHistory: History = {
	[nextTag]: {
		description: changelog,
	},
	...history,
}

updatedHistory[latestHistoryTag] = {
	...latestHistoryEntry,
	cid: latestCid,
}

writeFileSync(historyPath, `${JSON.stringify(updatedHistory, null, 2)}\n`)

