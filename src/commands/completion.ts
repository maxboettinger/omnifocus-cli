import type { Command } from "commander";

const BASH_COMPLETION = `# bash completion for of (omnifocus-cli)
_of_completion() {
	local cur prev words cword
	_init_completion || return

	local nouns="task project tag folder inbox bulk forecast review stats completion"
	local task_verbs="add list update complete search show subtask tag"
	local project_verbs="add list show update rename delete"
	local tag_verbs="add list rename delete tasks"
	local folder_verbs="add list"
	local inbox_verbs="list add process process-many"
	local bulk_verbs="create update complete"

	case "\${cword}" in
		1) COMPREPLY=( $(compgen -W "\${nouns}" -- "\${cur}") ) ;;
		2)
			case "\${prev}" in
				task)    COMPREPLY=( $(compgen -W "\${task_verbs}" -- "\${cur}") ) ;;
				project) COMPREPLY=( $(compgen -W "\${project_verbs}" -- "\${cur}") ) ;;
				tag)     COMPREPLY=( $(compgen -W "\${tag_verbs}" -- "\${cur}") ) ;;
				folder)  COMPREPLY=( $(compgen -W "\${folder_verbs}" -- "\${cur}") ) ;;
				inbox)   COMPREPLY=( $(compgen -W "\${inbox_verbs}" -- "\${cur}") ) ;;
				bulk)    COMPREPLY=( $(compgen -W "\${bulk_verbs}" -- "\${cur}") ) ;;
			esac
			;;
	esac
}
complete -F _of_completion of`;

const ZSH_COMPLETION = `#compdef of
# zsh completion for of (omnifocus-cli)

_of() {
	local -a nouns
	nouns=(
		'task:Manage tasks'
		'project:Manage projects'
		'tag:Manage tags'
		'folder:Manage folders'
		'inbox:Manage inbox'
		'bulk:Bulk operations'
		'forecast:Show forecast view'
		'review:Weekly review report'
		'stats:Statistics overview'
		'completion:Output shell completions'
	)

	local -a task_cmds project_cmds tag_cmds folder_cmds inbox_cmds bulk_cmds
	task_cmds=(
		'add:Create a task' 'list:List tasks' 'update:Update a task'
		'complete:Complete a task' 'search:Search tasks' 'show:Show task detail'
		'subtask:Add a subtask' 'tag:Apply tags to a task'
	)
	project_cmds=(
		'add:Create a project' 'list:List projects' 'show:Show project detail'
		'update:Update a project' 'rename:Rename a project' 'delete:Delete a project'
	)
	tag_cmds=(
		'add:Create a tag' 'list:List tags' 'rename:Rename a tag'
		'delete:Delete a tag' 'tasks:List tasks by tag'
	)
	folder_cmds=( 'add:Create a folder' 'list:List folders' )
	inbox_cmds=( 'list:List inbox items' 'add:Add to inbox' 'process:Process inbox item' 'process-many:Process many inbox items from stdin JSON' )
	bulk_cmds=( 'create:Bulk create tasks' 'update:Bulk update tasks' 'complete:Bulk complete tasks' )

	_arguments -C '1:noun:->noun' '2:verb:->verb' '*::args:->args'

	case "\$state" in
		noun)   _describe 'command' nouns ;;
		verb)
			case "\$words[2]" in
				task)    _describe 'subcommand' task_cmds ;;
				project) _describe 'subcommand' project_cmds ;;
				tag)     _describe 'subcommand' tag_cmds ;;
				folder)  _describe 'subcommand' folder_cmds ;;
				inbox)   _describe 'subcommand' inbox_cmds ;;
				bulk)    _describe 'subcommand' bulk_cmds ;;
			esac
			;;
	esac
}

_of "\$@"`;

const FISH_COMPLETION = `# fish completion for of (omnifocus-cli)

# Disable file completions
complete -c of -f

# Top-level commands
complete -c of -n __fish_use_subcommand -a task -d 'Manage tasks'
complete -c of -n __fish_use_subcommand -a project -d 'Manage projects'
complete -c of -n __fish_use_subcommand -a tag -d 'Manage tags'
complete -c of -n __fish_use_subcommand -a folder -d 'Manage folders'
complete -c of -n __fish_use_subcommand -a inbox -d 'Manage inbox'
complete -c of -n __fish_use_subcommand -a bulk -d 'Bulk operations'
complete -c of -n __fish_use_subcommand -a forecast -d 'Show forecast view'
complete -c of -n __fish_use_subcommand -a review -d 'Weekly review report'
complete -c of -n __fish_use_subcommand -a stats -d 'Statistics overview'
complete -c of -n __fish_use_subcommand -a completion -d 'Output shell completions'

# task subcommands
complete -c of -n '__fish_seen_subcommand_from task' -a add -d 'Create a task'
complete -c of -n '__fish_seen_subcommand_from task' -a list -d 'List tasks'
complete -c of -n '__fish_seen_subcommand_from task' -a update -d 'Update a task'
complete -c of -n '__fish_seen_subcommand_from task' -a complete -d 'Complete a task'
complete -c of -n '__fish_seen_subcommand_from task' -a search -d 'Search tasks'
complete -c of -n '__fish_seen_subcommand_from task' -a show -d 'Show task detail'
complete -c of -n '__fish_seen_subcommand_from task' -a subtask -d 'Add a subtask'
complete -c of -n '__fish_seen_subcommand_from task' -a tag -d 'Apply tags to a task'

# project subcommands
complete -c of -n '__fish_seen_subcommand_from project' -a add -d 'Create a project'
complete -c of -n '__fish_seen_subcommand_from project' -a list -d 'List projects'
complete -c of -n '__fish_seen_subcommand_from project' -a show -d 'Show project detail'
complete -c of -n '__fish_seen_subcommand_from project' -a update -d 'Update a project'
complete -c of -n '__fish_seen_subcommand_from project' -a rename -d 'Rename a project'
complete -c of -n '__fish_seen_subcommand_from project' -a delete -d 'Delete a project'

# tag subcommands
complete -c of -n '__fish_seen_subcommand_from tag' -a add -d 'Create a tag'
complete -c of -n '__fish_seen_subcommand_from tag' -a list -d 'List tags'
complete -c of -n '__fish_seen_subcommand_from tag' -a rename -d 'Rename a tag'
complete -c of -n '__fish_seen_subcommand_from tag' -a delete -d 'Delete a tag'
complete -c of -n '__fish_seen_subcommand_from tag' -a tasks -d 'List tasks by tag'

# folder subcommands
complete -c of -n '__fish_seen_subcommand_from folder' -a add -d 'Create a folder'
complete -c of -n '__fish_seen_subcommand_from folder' -a list -d 'List folders'

# inbox subcommands
complete -c of -n '__fish_seen_subcommand_from inbox' -a list -d 'List inbox items'
complete -c of -n '__fish_seen_subcommand_from inbox' -a add -d 'Add to inbox'
complete -c of -n '__fish_seen_subcommand_from inbox' -a process -d 'Process inbox item'
complete -c of -n '__fish_seen_subcommand_from inbox' -a process-many -d 'Process many inbox items from stdin JSON'

# bulk subcommands
complete -c of -n '__fish_seen_subcommand_from bulk' -a create -d 'Bulk create tasks'
complete -c of -n '__fish_seen_subcommand_from bulk' -a update -d 'Bulk update tasks'
complete -c of -n '__fish_seen_subcommand_from bulk' -a complete -d 'Bulk complete tasks'

# Global options
complete -c of -l json -d 'Output in JSON format'
complete -c of -l help -d 'Show help'
complete -c of -s V -l version -d 'Show version'`;

const SHELLS: Record<string, string> = {
	bash: BASH_COMPLETION,
	zsh: ZSH_COMPLETION,
	fish: FISH_COMPLETION,
};

export function registerCompletionCommand(parent: Command): void {
	parent
		.command("completion")
		.description("Output shell completion script")
		.argument("<shell>", "Shell type (bash, zsh, fish)")
		.action((shell: string) => {
			const script = SHELLS[shell];
			if (!script) {
				console.error(`Unknown shell: ${shell}. Supported: ${Object.keys(SHELLS).join(", ")}`);
				process.exit(1);
			}
			console.log(script);
		});
}
